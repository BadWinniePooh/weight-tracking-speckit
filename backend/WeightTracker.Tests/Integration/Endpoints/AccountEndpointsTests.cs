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

public class AccountEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private async Task<(User user, HttpClient client)> CreateAuthUserAsync(string? prefix = null)
    {
        fixture.EnsureTestUserExists();
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = new BcryptPasswordHasher();
        var username = $"{prefix ?? "account"}_{Guid.NewGuid():N}";
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@example.com",
            PasswordHash = hasher.Hash("pass123"),
            Role = "user",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var client = fixture.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer", ApiFixture.GenerateTestJwt(user.Id));
        return (user, client);
    }

    // T054: PUT /api/account/username updates username; duplicate returns 400
    [Fact]
    public async Task ChangeUsername_Valid_Returns200WithNewUsername()
    {
        var (user, client) = await CreateAuthUserAsync("uchange");
        var newUsername = $"newname_{Guid.NewGuid():N}";

        var response = await client.PutAsJsonAsync("/api/account/username",
            new { newUsername });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(newUsername, body.GetProperty("username").GetString());
    }

    [Fact]
    public async Task ChangeUsername_DuplicateUsername_Returns400()
    {
        var (user, client) = await CreateAuthUserAsync("udup");

        // Try to take the admin user's username
        var response = await client.PutAsJsonAsync("/api/account/username",
            new { newUsername = "adminuser" }); // adminuser is the seeded admin

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("newUsername", body.GetProperty("field").GetString());
    }

    // T055: PUT /api/account/password with correct current password succeeds; incorrect returns 400
    [Fact]
    public async Task ChangePassword_CorrectCurrent_Returns204()
    {
        var (user, client) = await CreateAuthUserAsync("pchange");

        var response = await client.PutAsJsonAsync("/api/account/password",
            new { currentPassword = "pass123", newPassword = "newpass456" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Login with new password should succeed
        var loginResp = await fixture.CreateClient().PostAsJsonAsync("/api/auth/login",
            new { username = user.Username, password = "newpass456" });
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_IncorrectCurrent_Returns400()
    {
        var (user, client) = await CreateAuthUserAsync("pwrong");

        var response = await client.PutAsJsonAsync("/api/account/password",
            new { currentPassword = "wrongpassword", newPassword = "newpass456" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("currentPassword", body.GetProperty("field").GetString());
    }

    // T056: PUT /api/account/email sends confirmation to new address; old email works until confirmed
    [Fact]
    public async Task ChangeEmail_SendsConfirmationToNewAddress()
    {
        fixture.FakeEmail.Clear();
        var (user, client) = await CreateAuthUserAsync("emailchange");
        var newEmail = $"newemail_{Guid.NewGuid():N}@example.com";

        var response = await client.PutAsJsonAsync("/api/account/email",
            new { newEmail });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(newEmail, body.GetProperty("message").GetString()!);

        // Confirmation email should be sent to new address
        Assert.Single(fixture.FakeEmail.Messages);
        Assert.Equal(newEmail, fixture.FakeEmail.Messages[0].To);
    }

    [Fact]
    public async Task ChangeEmail_ConfirmingNewEmailSwitchesAddress()
    {
        fixture.FakeEmail.Clear();
        var (user, client) = await CreateAuthUserAsync("emailswitch");
        var newEmail = $"switched_{Guid.NewGuid():N}@example.com";

        await client.PutAsJsonAsync("/api/account/email", new { newEmail });

        // Extract token
        var emailBody = fixture.FakeEmail.Messages.Last().Body;
        var token = ExtractTokenFromEmailBody(emailBody);

        // Confirm new email
        var confirmResp = await fixture.CreateClient().GetAsync($"/api/auth/confirm-email?token={token}");
        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);

        // Verify email was updated in DB
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var updatedUser = await db.Users.FindAsync(user.Id);
        Assert.Equal(newEmail, updatedUser!.Email);
    }

    [Fact]
    public async Task ChangeEmail_DuplicateEmail_Returns400()
    {
        var (user, client) = await CreateAuthUserAsync("emaildup");

        // Try to take the admin's email
        var response = await client.PutAsJsonAsync("/api/account/email",
            new { newEmail = "admin@example.com" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("newEmail", body.GetProperty("field").GetString());
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
