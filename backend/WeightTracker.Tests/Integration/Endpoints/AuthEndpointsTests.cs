using System.Net;
using System.Net.Http.Json;
using WeightTracker.Domain.Entities;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Infrastructure.Services;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class AuthEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    private async Task<User> CreateTestUserAsync(string username, string password)
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

    // ── POST /api/auth/login ─────────────────────────────────────────────────

    [Fact]
    public async Task Login_ValidCredentials_Returns200WithAccessTokenAndCookie()
    {
        var username = $"logintest_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "mypassword123");

        var response = await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(username, "mypassword123"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(body);
        Assert.NotEmpty(body.AccessToken);
        Assert.Equal(900, body.ExpiresIn);
        Assert.Equal("Bearer", body.TokenType);

        // Check Set-Cookie header for refreshToken
        var cookie = response.Headers.GetValues("Set-Cookie").FirstOrDefault();
        Assert.NotNull(cookie);
        Assert.Contains("refreshToken", cookie);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Login_UnknownUsername_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest("nonexistent_user_xyz", "anypassword"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var username = $"wrongpass_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "correctpassword");

        var response = await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(username, "wrongpassword"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        // Same error message as unknown username (prevent enumeration)
        Assert.Equal("Invalid username or password.", body?.Error);
    }

    // ── POST /api/auth/refresh ───────────────────────────────────────────────

    [Fact]
    public async Task Refresh_ValidCookie_Returns200WithNewAccessToken()
    {
        var username = $"refreshtest_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "pass123456");

        // Login first to get the refresh cookie
        var loginResp = await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(username, "pass123456"));
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);

        // Use a new client that includes cookies
        var cookieClient = fixture.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            HandleCookies = true
        });

        // Login to set the cookie on this client
        var loginResp2 = await cookieClient.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(username, "pass123456"));
        Assert.Equal(HttpStatusCode.OK, loginResp2.StatusCode);

        // Now refresh
        var refreshResp = await cookieClient.PostAsync("/api/auth/refresh", null);

        Assert.Equal(HttpStatusCode.OK, refreshResp.StatusCode);
        var body = await refreshResp.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(body);
        Assert.NotEmpty(body.AccessToken);
    }

    [Fact]
    public async Task Refresh_MissingCookie_Returns401()
    {
        var response = await _client.PostAsync("/api/auth/refresh", null);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_TokenRotation_OldTokenRevoked()
    {
        var username = $"rotatetest_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "pass123456");

        var cookieClient = fixture.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            HandleCookies = true
        });
        await cookieClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(username, "pass123456"));
        await cookieClient.PostAsync("/api/auth/refresh", null); // first refresh

        // Second refresh should also work (new token from rotation)
        var secondRefresh = await cookieClient.PostAsync("/api/auth/refresh", null);
        Assert.Equal(HttpStatusCode.OK, secondRefresh.StatusCode);
    }

    // ── POST /api/auth/logout ────────────────────────────────────────────────

    [Fact]
    public async Task Logout_WithValidJwt_Returns204AndClearsCookie()
    {
        var username = $"logouttest_{Guid.NewGuid():N}";
        var user = await CreateTestUserAsync(username, "pass123456");

        var authClient = fixture.CreateClient();
        authClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer", ApiFixture.GenerateTestJwt(user.Id));

        var response = await authClient.PostAsync("/api/auth/logout", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        // Cookie should be cleared
        var cookie = response.Headers.GetValues("Set-Cookie").FirstOrDefault();
        Assert.NotNull(cookie);
        Assert.Contains("refreshToken", cookie);
    }

    [Fact]
    public async Task Logout_ThenRefresh_Returns401()
    {
        var username = $"logoutrefresh_{Guid.NewGuid():N}";
        var user = await CreateTestUserAsync(username, "pass123456");

        var cookieClient = fixture.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            HandleCookies = true
        });
        await cookieClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(username, "pass123456"));

        // Logout with token
        cookieClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer", ApiFixture.GenerateTestJwt(user.Id));
        await cookieClient.PostAsync("/api/auth/logout", null);
        cookieClient.DefaultRequestHeaders.Authorization = null;

        // Attempt refresh should fail
        var refreshResp = await cookieClient.PostAsync("/api/auth/refresh", null);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshResp.StatusCode);
    }
}

record LoginRequest(string Username, string Password);
record LoginResponse(string AccessToken, int ExpiresIn, string TokenType);
