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

public class AdminEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private HttpClient AdminClient => fixture.CreateAuthenticatedAdminClient();
    private HttpClient UserClient => fixture.CreateAuthenticatedClient();

    private async Task<User> CreateTestTargetUserAsync(string? usernamePrefix = null)
    {
        fixture.EnsureTestUserExists();
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = new BcryptPasswordHasher();
        var username = $"{usernamePrefix ?? "admintarget"}_{Guid.NewGuid():N}";
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
        return user;
    }

    // T034: GET /api/admin/users returns user list; non-admin gets 403
    [Fact]
    public async Task GetUsers_AsAdmin_Returns200WithUserList()
    {
        fixture.EnsureTestUserExists();
        var client = AdminClient;

        var response = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var users = body.GetProperty("users");
        Assert.True(users.GetArrayLength() > 0);

        // Verify required fields exist in each user
        var firstUser = users[0];
        Assert.True(firstUser.TryGetProperty("id", out _));
        Assert.True(firstUser.TryGetProperty("username", out _));
        Assert.True(firstUser.TryGetProperty("email", out _));
        Assert.True(firstUser.TryGetProperty("role", out _));
        Assert.True(firstUser.TryGetProperty("isActive", out _));
        Assert.True(firstUser.TryGetProperty("emailConfirmed", out _));
        Assert.True(firstUser.TryGetProperty("createdAt", out _));
    }

    [Fact]
    public async Task GetUsers_AsRegularUser_Returns403()
    {
        fixture.EnsureTestUserExists();
        var response = await UserClient.GetAsync("/api/admin/users");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetUsers_Unauthenticated_Returns401()
    {
        var response = await fixture.CreateClient().GetAsync("/api/admin/users");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // T035: POST /api/admin/users creates user with EmailConfirmed=false and sends email
    [Fact]
    public async Task CreateUser_AsAdmin_Returns201WithUnconfirmedUser()
    {
        fixture.FakeEmail.Clear();
        var username = $"newadmin_{Guid.NewGuid():N}";
        var email = $"{username}@example.com";

        var response = await AdminClient.PostAsJsonAsync("/api/admin/users",
            new { username, email, role = "user" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(username, body.GetProperty("username").GetString());
        Assert.Equal(email, body.GetProperty("email").GetString());
        Assert.False(body.GetProperty("emailConfirmed").GetBoolean());
        Assert.True(body.GetProperty("isActive").GetBoolean());

        // Confirmation email should have been sent
        Assert.Single(fixture.FakeEmail.Messages);
        Assert.Equal(email, fixture.FakeEmail.Messages[0].To);
    }

    [Fact]
    public async Task CreateUser_DuplicateUsername_Returns400()
    {
        fixture.EnsureTestUserExists();

        var response = await AdminClient.PostAsJsonAsync("/api/admin/users",
            new { username = "testuser", email = "new@example.com", role = "user" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("username", body.GetProperty("field").GetString());
    }

    // T036: POST /api/admin/users/{id}/deactivate sets IsActive=false and ScheduledDeletionAt
    [Fact]
    public async Task DeactivateUser_AsAdmin_SetsInactiveAndSchedulesDeletion()
    {
        var target = await CreateTestTargetUserAsync("deactivate");

        var response = await AdminClient.PostAsync($"/api/admin/users/{target.Id}/deactivate", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(target.Id.ToString(), body.GetProperty("id").GetString());
        Assert.False(body.GetProperty("isActive").GetBoolean());
        Assert.NotEqual(JsonValueKind.Null, body.GetProperty("scheduledDeletionAt").ValueKind);
    }

    [Fact]
    public async Task DeactivateUser_DeactivatedUserCannotLogin()
    {
        var target = await CreateTestTargetUserAsync("deactivlogin");
        await AdminClient.PostAsync($"/api/admin/users/{target.Id}/deactivate", null);

        var loginResp = await fixture.CreateClient().PostAsJsonAsync("/api/auth/login",
            new { username = target.Username, password = "pass123" });

        Assert.Equal(HttpStatusCode.Unauthorized, loginResp.StatusCode);
        var body = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("deactivated", body.GetProperty("error").GetString()!,
            StringComparison.OrdinalIgnoreCase);
    }

    // T037: POST /api/admin/users/{id}/reactivate restores IsActive=true and clears ScheduledDeletionAt
    [Fact]
    public async Task ReactivateUser_AsAdmin_RestoresActiveAndClearsDeletion()
    {
        var target = await CreateTestTargetUserAsync("reactivate");
        await AdminClient.PostAsync($"/api/admin/users/{target.Id}/deactivate", null);

        var response = await AdminClient.PostAsync($"/api/admin/users/{target.Id}/reactivate", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("isActive").GetBoolean());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("scheduledDeletionAt").ValueKind);
    }

    // T038: DELETE /api/admin/users/{id} permanently removes user and associated data
    [Fact]
    public async Task DeleteUser_AsAdmin_Returns204AndUserIsGone()
    {
        var target = await CreateTestTargetUserAsync("deleteme");

        var response = await AdminClient.DeleteAsync($"/api/admin/users/{target.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // User should be gone — verify by trying to list users and checking it's absent
        var listResp = await AdminClient.GetAsync("/api/admin/users");
        var body = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.GetProperty("users").EnumerateArray()
            .Select(u => u.GetProperty("id").GetString())
            .ToList();
        Assert.DoesNotContain(target.Id.ToString(), ids);
    }

    // T039: PUT /api/admin/users/{id}/role and POST /api/admin/users/{id}/resend-confirmation
    [Fact]
    public async Task AssignRole_AsAdmin_ChangesUserRole()
    {
        var target = await CreateTestTargetUserAsync("rolechange");

        var response = await AdminClient.PutAsJsonAsync($"/api/admin/users/{target.Id}/role",
            new { role = "admin" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(target.Id.ToString(), body.GetProperty("id").GetString());
        Assert.Equal("admin", body.GetProperty("role").GetString());
    }

    [Fact]
    public async Task ResendConfirmation_AsAdmin_SendsEmail()
    {
        fixture.FakeEmail.Clear();
        // Create an unconfirmed user
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var username = $"resendadmin_{Guid.NewGuid():N}";
        var unconfirmed = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@example.com",
            PasswordHash = "testhash",
            Role = "user",
            IsActive = true,
            EmailConfirmed = false,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(unconfirmed);
        await db.SaveChangesAsync();

        var response = await AdminClient.PostAsync($"/api/admin/users/{unconfirmed.Id}/resend-confirmation", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Single(fixture.FakeEmail.Messages);
        Assert.Equal(unconfirmed.Email, fixture.FakeEmail.Messages[0].To);
    }

    // T040: Actions on own account return 400; successful actions create audit log entries
    [Fact]
    public async Task DeactivateOwnAccount_Returns400()
    {
        fixture.EnsureTestUserExists();
        var response = await AdminClient.PostAsync($"/api/admin/users/{ApiFixture.AdminUserId}/deactivate", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteOwnAccount_Returns400()
    {
        fixture.EnsureTestUserExists();
        var response = await AdminClient.DeleteAsync($"/api/admin/users/{ApiFixture.AdminUserId}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AssignRoleToOwnAccount_Returns400()
    {
        fixture.EnsureTestUserExists();
        var response = await AdminClient.PutAsJsonAsync($"/api/admin/users/{ApiFixture.AdminUserId}/role",
            new { role = "user" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeactivateUser_CreatesAuditLogEntry()
    {
        var target = await CreateTestTargetUserAsync("auditlog");
        await AdminClient.PostAsync($"/api/admin/users/{target.Id}/deactivate", null);

        // Verify audit log was created
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var entry = await System.Threading.Tasks.Task.Run(async () =>
            await db.AuditLog.FirstOrDefaultAsync(a =>
                a.ActionType == "user_deactivated" &&
                a.TargetUserId == target.Id));

        Assert.NotNull(entry);
        Assert.Equal(ApiFixture.AdminUserId, entry.ActorUserId);
    }
}

// Import needed for FirstOrDefaultAsync
file static class DbContextExtensions
{
    public static async Task<WeightTracker.Domain.Entities.AuditLogEntry?> FirstOrDefaultAsync(
        this Microsoft.EntityFrameworkCore.DbSet<WeightTracker.Domain.Entities.AuditLogEntry> set,
        System.Linq.Expressions.Expression<Func<WeightTracker.Domain.Entities.AuditLogEntry, bool>> predicate)
        => await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(set, predicate);
}
