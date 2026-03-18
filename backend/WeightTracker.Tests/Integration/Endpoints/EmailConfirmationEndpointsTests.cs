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

public class EmailConfirmationEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    private async Task<User> CreateUnconfirmedUserAsync(string username, string password)
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
            EmailConfirmed = false, // unconfirmed
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    // T024: Unconfirmed user attempting login receives 401 with "confirm your email" message
    [Fact]
    public async Task Login_UnconfirmedUser_Returns401WithConfirmMessage()
    {
        var user = await CreateUnconfirmedUserAsync($"unconfirmed_{Guid.NewGuid():N}", "pass123");

        var response = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = user.Username, password = "pass123" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("confirm your email", body.GetProperty("error").GetString()!,
            StringComparison.OrdinalIgnoreCase);
    }

    // T025: GET /api/auth/confirm-email with valid token sets EmailConfirmed=true; subsequent login succeeds
    [Fact]
    public async Task ConfirmEmail_ValidToken_SetsConfirmedAndLoginSucceeds()
    {
        fixture.FakeEmail.Clear();
        var password = "pass123";
        var user = await CreateUnconfirmedUserAsync($"confirmtest_{Guid.NewGuid():N}", password);

        // Use the email confirmation service to send a token
        await using var scope = fixture.Services.CreateAsyncScope();
        var emailConfirmSvc = scope.ServiceProvider.GetRequiredService<WeightTracker.Domain.Interfaces.Services.IEmailConfirmationService>();
        await emailConfirmSvc.SendConfirmationAsync(user.Id, user.Email);

        Assert.Single(fixture.FakeEmail.Messages);
        var emailBody = fixture.FakeEmail.Messages[0].Body;
        var token = ExtractTokenFromEmailBody(emailBody);

        // Confirm the email
        var confirmResp = await _client.GetAsync($"/api/auth/confirm-email?token={token}");
        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);
        var body = await confirmResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Email confirmed. You may now log in.", body.GetProperty("message").GetString());

        // Login should now succeed
        var loginResp = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = user.Username, password });
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
    }

    // T026: Expired token returns 400; used token returns 400
    [Fact]
    public async Task ConfirmEmail_ExpiredToken_Returns400()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await CreateUnconfirmedUserAsync($"expconf_{Guid.NewGuid():N}", "pass123");

        var plaintext = "expiredconfirmtoken1234567890ab";
        var hash = Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(plaintext))).ToLowerInvariant();

        db.EmailConfirmationTokens.Add(new EmailConfirmationToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TargetEmail = user.Email,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddHours(-1), // expired
            CreatedAt = DateTime.UtcNow.AddHours(-25)
        });
        await db.SaveChangesAsync();

        var response = await _client.GetAsync($"/api/auth/confirm-email?token={plaintext}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("invalid or has expired", body.GetProperty("error").GetString()!,
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ConfirmEmail_UsedToken_Returns400()
    {
        fixture.FakeEmail.Clear();
        var user = await CreateUnconfirmedUserAsync($"usedconf_{Guid.NewGuid():N}", "pass123");

        await using var scope = fixture.Services.CreateAsyncScope();
        var emailConfirmSvc = scope.ServiceProvider.GetRequiredService<WeightTracker.Domain.Interfaces.Services.IEmailConfirmationService>();
        await emailConfirmSvc.SendConfirmationAsync(user.Id, user.Email);

        var emailBody = fixture.FakeEmail.Messages.Last().Body;
        var token = ExtractTokenFromEmailBody(emailBody);

        // Use the token once
        var firstConfirm = await _client.GetAsync($"/api/auth/confirm-email?token={token}");
        Assert.Equal(HttpStatusCode.OK, firstConfirm.StatusCode);

        // Use the token again
        var secondConfirm = await _client.GetAsync($"/api/auth/confirm-email?token={token}");
        Assert.Equal(HttpStatusCode.BadRequest, secondConfirm.StatusCode);
    }

    // 014: GET /api/auth/confirm-email success response includes passwordResetToken
    [Fact]
    public async Task ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken()
    {
        fixture.FakeEmail.Clear();
        var user = await CreateUnconfirmedUserAsync($"pwsetup_{Guid.NewGuid():N}", "pass123");

        await using var scope = fixture.Services.CreateAsyncScope();
        var emailConfirmSvc = scope.ServiceProvider.GetRequiredService<WeightTracker.Domain.Interfaces.Services.IEmailConfirmationService>();
        await emailConfirmSvc.SendConfirmationAsync(user.Id, user.Email);

        var emailBody = fixture.FakeEmail.Messages.Last().Body;
        var token = ExtractTokenFromEmailBody(emailBody);

        var response = await _client.GetAsync($"/api/auth/confirm-email?token={token}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("passwordResetToken", out var resetTokenProp),
            "Response should contain a 'passwordResetToken' property");
        var resetToken = resetTokenProp.GetString();
        Assert.False(string.IsNullOrWhiteSpace(resetToken),
            "passwordResetToken should be a non-empty string");
    }

    // T027: ResendConfirmationAsync generates a new token and delivers email
    [Fact]
    public async Task ResendConfirmation_GeneratesNewTokenAndSendsEmail()
    {
        fixture.FakeEmail.Clear();
        var user = await CreateUnconfirmedUserAsync($"resend_{Guid.NewGuid():N}", "pass123");

        await using var scope = fixture.Services.CreateAsyncScope();
        var emailConfirmSvc = scope.ServiceProvider.GetRequiredService<WeightTracker.Domain.Interfaces.Services.IEmailConfirmationService>();
        await emailConfirmSvc.ResendConfirmationAsync(user.Id);

        Assert.Single(fixture.FakeEmail.Messages);
        var email = fixture.FakeEmail.Messages[0];
        Assert.Equal(user.Email, email.To);
        Assert.Contains("http://localhost:3000/confirm-email.html?token=", email.Body);
    }

    private static string ExtractTokenFromEmailBody(string body)
    {
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
}
