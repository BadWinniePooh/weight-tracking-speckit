using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using WeightTracker.Domain.Entities;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Infrastructure.Services;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class PasswordResetEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    private async Task<User> CreateConfirmedUserAsync(string username, string password)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = new BcryptPasswordHasher();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@example.com",
            PasswordHash = hasher.Hash(password),
            Role = "user",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    // T014: POST /api/auth/forgot-password returns 200 for known AND unknown email (anti-enumeration)
    [Fact]
    public async Task ForgotPassword_KnownEmail_Returns200WithExpectedMessage()
    {
        var user = await CreateConfirmedUserAsync($"pwreset_known_{Guid.NewGuid():N}", "pass123");

        var response = await _client.PostAsJsonAsync("/api/auth/forgot-password",
            new { email = user.Email });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("If an account with that email exists, a reset link has been sent.",
            body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task ForgotPassword_UnknownEmail_Returns200WithSameMessage()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/forgot-password",
            new { email = "nobody@nowhere.com" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("If an account with that email exists, a reset link has been sent.",
            body.GetProperty("message").GetString());
    }

    // T015: POST /api/auth/forgot-password for existing user delivers email
    [Fact]
    public async Task ForgotPassword_ExistingUser_SendsEmailWithTokenUrl()
    {
        fixture.FakeEmail.Clear();
        var user = await CreateConfirmedUserAsync($"pwreset_email_{Guid.NewGuid():N}", "pass123");

        await _client.PostAsJsonAsync("/api/auth/forgot-password", new { email = user.Email });

        // Assert email was sent
        Assert.Single(fixture.FakeEmail.Messages);
        var email = fixture.FakeEmail.Messages[0];
        Assert.Equal(user.Email, email.To);
        Assert.Contains("reset", email.Subject, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("http://localhost:3000/reset-password.html?token=", email.Body);
    }

    // T016: POST /api/auth/reset-password with valid token resets password; token cannot be reused
    [Fact]
    public async Task ResetPassword_ValidToken_UpdatesPasswordAndLoginSucceeds()
    {
        fixture.FakeEmail.Clear();
        var originalPassword = "originalPass123";
        var newPassword = "newSecurePass456";
        var user = await CreateConfirmedUserAsync($"pwreset_valid_{Guid.NewGuid():N}", originalPassword);

        // Request a reset
        await _client.PostAsJsonAsync("/api/auth/forgot-password", new { email = user.Email });
        Assert.Single(fixture.FakeEmail.Messages);

        // Extract token from email body (URL ends at first quote, angle bracket, or whitespace)
        var emailBody = fixture.FakeEmail.Messages[0].Body;
        var token = ExtractTokenFromEmailBody(emailBody);

        // Reset the password
        var resetResponse = await _client.PostAsJsonAsync("/api/auth/reset-password",
            new { token, newPassword });
        Assert.Equal(HttpStatusCode.OK, resetResponse.StatusCode);
        var resetBody = await resetResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Password has been reset. You may now log in.",
            resetBody.GetProperty("message").GetString());

        // Login with new password should succeed
        var loginResp = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = user.Username, password = newPassword });
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);

        // Login with old password should fail
        var oldLoginResp = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = user.Username, password = originalPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLoginResp.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_TokenUsedTwice_Returns400OnSecondUse()
    {
        fixture.FakeEmail.Clear();
        var user = await CreateConfirmedUserAsync($"pwreset_reuse_{Guid.NewGuid():N}", "pass123");

        await _client.PostAsJsonAsync("/api/auth/forgot-password", new { email = user.Email });
        var emailBody = fixture.FakeEmail.Messages[0].Body;
        var token = ExtractTokenFromEmailBody(emailBody);

        // First use should succeed
        var firstReset = await _client.PostAsJsonAsync("/api/auth/reset-password",
            new { token, newPassword = "newPass111" });
        Assert.Equal(HttpStatusCode.OK, firstReset.StatusCode);

        // Second use should fail
        var secondReset = await _client.PostAsJsonAsync("/api/auth/reset-password",
            new { token, newPassword = "newPass222" });
        Assert.Equal(HttpStatusCode.BadRequest, secondReset.StatusCode);
        var body = await secondReset.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("invalid or has expired", body.GetProperty("error").GetString()!,
            StringComparison.OrdinalIgnoreCase);
    }

    private static string ExtractTokenFromEmailBody(string body)
    {
        // URL pattern: ...?token=TOKENVALUE" or ...?token=TOKENVALUE\n
        var marker = "token=";
        var start = body.IndexOf(marker);
        if (start < 0) throw new Exception("Token not found in email body");
        start += marker.Length;
        var end = start;
        while (end < body.Length && body[end] != '"' && body[end] != '\'' &&
               body[end] != '<' && body[end] != '>' && body[end] != ' ' &&
               body[end] != '\n' && body[end] != '\r')
            end++;
        return body[start..end];
    }

    // T017: POST /api/auth/reset-password with expired token returns 400
    [Fact]
    public async Task ResetPassword_ExpiredToken_Returns400()
    {
        // Insert an expired token directly into DB
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await CreateConfirmedUserAsync($"pwreset_exp_{Guid.NewGuid():N}", "pass123");

        // Re-fetch user from DB to get the tracked entity
        var dbUser = await db.Users.FindAsync(user.Id);

        // Create a plaintext token and hash it
        var plaintext = "expiredtokenvalue12345678901234";
        var hash = Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(plaintext))).ToLowerInvariant();

        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddHours(-1), // expired
            CreatedAt = DateTime.UtcNow.AddHours(-2)
        });
        await db.SaveChangesAsync();

        var response = await _client.PostAsJsonAsync("/api/auth/reset-password",
            new { token = plaintext, newPassword = "newPass123" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("invalid or has expired", body.GetProperty("error").GetString()!,
            StringComparison.OrdinalIgnoreCase);
    }
}
