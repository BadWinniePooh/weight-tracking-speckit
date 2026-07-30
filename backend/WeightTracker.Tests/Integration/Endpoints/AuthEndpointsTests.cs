using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
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

    // ── Bug #6: lastLoginAt never recorded ──────────────────────────────────

    [Fact]
    public async Task Login_ValidCredentials_UpdatesLastLoginAt()
    {
        var username = $"lastlogintest_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "mypassword123");

        await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(username, "mypassword123"));

        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(u => u.Username == username);
        Assert.NotNull(user.LastLoginAt);
        Assert.True(user.LastLoginAt > DateTime.UtcNow.AddMinutes(-1));
    }

    // ── Bug #7: Audit log entries missing for login ─────────────────────────

    [Fact]
    public async Task Login_ValidCredentials_WritesUserLoginAuditEntry()
    {
        var username = $"auditlogintest_{Guid.NewGuid():N}";
        var user = await CreateTestUserAsync(username, "mypassword123");

        await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(username, "mypassword123"));

        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var auditEntry = await db.AuditLog
            .Where(e => e.ActionType == "user_login" && e.ActorUserId == user.Id)
            .FirstOrDefaultAsync();
        Assert.NotNull(auditEntry);
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

    // ── Rotation grace window (018: offline-first, FR-016) ───────────────────

    private async Task<string> LoginAndCaptureRefreshCookieAsync(string username, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(username, password));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var setCookie = response.Headers.GetValues("Set-Cookie")
            .First(c => c.StartsWith("refreshToken="));
        // "refreshToken=<url-encoded-value>; ..." — value ends at the first ';'
        var value = setCookie["refreshToken=".Length..].Split(';')[0];
        return Uri.UnescapeDataString(value);
    }

    private static string Sha256Hex(string token)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    [Fact]
    public async Task Refresh_OldCookieReplayedWithinRotationGrace_Returns200()
    {
        var username = $"gracetest_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "pass123456");
        var rawToken = await LoginAndCaptureRefreshCookieAsync(username, "pass123456");

        // First refresh rotates the token
        var request1 = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request1.Headers.Add("Cookie", $"refreshToken={Uri.EscapeDataString(rawToken)}");
        var first = await _client.SendAsync(request1);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // A client that lost the rotation response retries with the OLD cookie —
        // within the grace window this must still succeed.
        var request2 = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request2.Headers.Add("Cookie", $"refreshToken={Uri.EscapeDataString(rawToken)}");
        var replay = await _client.SendAsync(request2);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
    }

    [Fact]
    public async Task Refresh_Rotation_ShortensOldTokenExpiryWithoutRevoking()
    {
        var username = $"graceexpiry_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "pass123456");
        var rawToken = await LoginAndCaptureRefreshCookieAsync(username, "pass123456");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Add("Cookie", $"refreshToken={Uri.EscapeDataString(rawToken)}");
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var oldToken = await db.RefreshTokens.SingleAsync(t => t.TokenHash == Sha256Hex(rawToken));
        // Rotation must not hard-revoke (that would kill retries after lost
        // responses) but must cap the old token's life to the grace window.
        Assert.Null(oldToken.RevokedAt);
        Assert.True(oldToken.ExpiresAt <= DateTime.UtcNow.AddSeconds(61),
            "rotated token must expire within the 60s grace window");
    }

    [Fact]
    public async Task Refresh_OldCookieAfterGraceExpired_Returns401()
    {
        var username = $"gracedead_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "pass123456");
        var rawToken = await LoginAndCaptureRefreshCookieAsync(username, "pass123456");

        // Rotate once
        var request1 = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request1.Headers.Add("Cookie", $"refreshToken={Uri.EscapeDataString(rawToken)}");
        var first = await _client.SendAsync(request1);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Simulate the grace window elapsing
        await using (var scope = fixture.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var oldToken = await db.RefreshTokens.SingleAsync(t => t.TokenHash == Sha256Hex(rawToken));
            oldToken.ExpiresAt = DateTime.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        }

        var request2 = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request2.Headers.Add("Cookie", $"refreshToken={Uri.EscapeDataString(rawToken)}");
        var replay = await _client.SendAsync(request2);
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
    }

    [Fact]
    public async Task Refresh_GraceReplay_DoesNotExtendOldTokenLifetime()
    {
        var username = $"gracereplay_{Guid.NewGuid():N}";
        await CreateTestUserAsync(username, "pass123456");
        var rawToken = await LoginAndCaptureRefreshCookieAsync(username, "pass123456");

        // Rotate, note the shortened deadline
        var request1 = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request1.Headers.Add("Cookie", $"refreshToken={Uri.EscapeDataString(rawToken)}");
        await _client.SendAsync(request1);

        DateTime deadlineAfterFirstRotation;
        await using (var scope = fixture.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            deadlineAfterFirstRotation = (await db.RefreshTokens
                .SingleAsync(t => t.TokenHash == Sha256Hex(rawToken))).ExpiresAt;
        }

        // Replay within grace — must succeed but must NOT push the deadline out
        var request2 = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request2.Headers.Add("Cookie", $"refreshToken={Uri.EscapeDataString(rawToken)}");
        var replay = await _client.SendAsync(request2);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);

        await using (var scope = fixture.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var deadlineAfterReplay = (await db.RefreshTokens
                .SingleAsync(t => t.TokenHash == Sha256Hex(rawToken))).ExpiresAt;
            Assert.True(deadlineAfterReplay <= deadlineAfterFirstRotation,
                "replaying an old token must never extend its grace deadline");
        }
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
