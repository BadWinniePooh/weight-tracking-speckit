using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using WeightTracker.Domain.Entities;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class AuditLogEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private async Task InsertAuditEntriesAsync(params AuditLogEntry[] entries)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.AuditLog.AddRange(entries);
        await db.SaveChangesAsync();
    }

    private AuditLogEntry MakeEntry(string actionType, DateTime? timestamp = null) => new()
    {
        Id = Guid.NewGuid(),
        ActionType = actionType,
        ActorUserId = ApiFixture.AdminUserId,
        TargetUserId = ApiFixture.TestUserId,
        IpAddress = "127.0.0.1",
        Timestamp = timestamp ?? DateTime.UtcNow
    };

    // T059: GET /api/admin/audit-log returns paginated entries with all required fields
    [Fact]
    public async Task GetAuditLog_AsAdmin_Returns200WithEntries()
    {
        fixture.EnsureTestUserExists();
        await InsertAuditEntriesAsync(
            MakeEntry("user_created"),
            MakeEntry("user_deactivated"),
            MakeEntry("user_reactivated"));

        var client = fixture.CreateAuthenticatedAdminClient();
        var response = await client.GetAsync("/api/admin/audit-log");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("entries").GetArrayLength() >= 3);
        Assert.True(body.GetProperty("totalCount").GetInt32() >= 3);
        Assert.True(body.GetProperty("page").GetInt32() >= 1);
        Assert.True(body.GetProperty("pageSize").GetInt32() > 0);

        // Verify required fields in first entry
        var entry = body.GetProperty("entries")[0];
        Assert.True(entry.TryGetProperty("id", out _));
        Assert.True(entry.TryGetProperty("actionType", out _));
        Assert.True(entry.TryGetProperty("actorUserId", out _));
        Assert.True(entry.TryGetProperty("ipAddress", out _));
        Assert.True(entry.TryGetProperty("timestamp", out _));
    }

    [Fact]
    public async Task GetAuditLog_Pagination_WorksCorrectly()
    {
        fixture.EnsureTestUserExists();
        // Insert at least 5 entries for pagination test
        for (int i = 0; i < 5; i++)
            await InsertAuditEntriesAsync(MakeEntry("role_changed"));

        var client = fixture.CreateAuthenticatedAdminClient();
        var response = await client.GetAsync("/api/admin/audit-log?page=1&pageSize=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, body.GetProperty("entries").GetArrayLength());
        Assert.Equal(1, body.GetProperty("page").GetInt32());
        Assert.Equal(2, body.GetProperty("pageSize").GetInt32());
    }

    // T060: fromDate/toDate filter returns only matching entries; actionType filter works
    [Fact]
    public async Task GetAuditLog_ActionTypeFilter_ReturnsOnlyMatchingEntries()
    {
        fixture.EnsureTestUserExists();
        var uniqueAction = $"test_action_{Guid.NewGuid():N}";
        await InsertAuditEntriesAsync(
            MakeEntry(uniqueAction),
            MakeEntry(uniqueAction));

        var client = fixture.CreateAuthenticatedAdminClient();
        var response = await client.GetAsync($"/api/admin/audit-log?actionType={uniqueAction}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, body.GetProperty("entries").GetArrayLength());
        foreach (var entry in body.GetProperty("entries").EnumerateArray())
            Assert.Equal(uniqueAction, entry.GetProperty("actionType").GetString());
    }

    [Fact]
    public async Task GetAuditLog_DateFilter_ReturnsOnlyMatchingEntries()
    {
        fixture.EnsureTestUserExists();
        var past = DateTime.UtcNow.AddDays(-5);
        var recentAction = $"dated_{Guid.NewGuid():N}";
        await InsertAuditEntriesAsync(
            new AuditLogEntry
            {
                Id = Guid.NewGuid(),
                ActionType = recentAction,
                ActorUserId = ApiFixture.AdminUserId,
                TargetUserId = ApiFixture.TestUserId,
                IpAddress = "127.0.0.1",
                Timestamp = past
            });

        var client = fixture.CreateAuthenticatedAdminClient();
        // Filter to only entries from yesterday onwards — should exclude the past entry
        var fromDate = DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-dd");
        var response = await client.GetAsync($"/api/admin/audit-log?fromDate={fromDate}&actionType={recentAction}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetProperty("entries").GetArrayLength());
    }

    // T061: Non-admin user receives 403
    [Fact]
    public async Task GetAuditLog_NonAdmin_Returns403()
    {
        fixture.EnsureTestUserExists();
        var response = await fixture.CreateAuthenticatedClient().GetAsync("/api/admin/audit-log");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // T009: Audit log entries include actorUsername (resolved via JOIN) and targetUsername (nullable)
    [Fact]
    public async Task GetAuditLog_EntriesIncludeActorUsername_NonNullNonEmpty()
    {
        fixture.EnsureTestUserExists();
        await InsertAuditEntriesAsync(MakeEntry("role_changed"));

        var client = fixture.CreateAuthenticatedAdminClient();
        var response = await client.GetAsync("/api/admin/audit-log");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var entries = body.GetProperty("entries");
        Assert.True(entries.GetArrayLength() >= 1);

        // Every entry must have a non-null, non-empty actorUsername
        foreach (var entry in entries.EnumerateArray())
        {
            Assert.True(entry.TryGetProperty("actorUsername", out var actorUsername),
                "Entry is missing actorUsername field");
            Assert.NotNull(actorUsername.GetString());
            Assert.NotEmpty(actorUsername.GetString()!);
        }
    }

    [Fact]
    public async Task GetAuditLog_EntryWithTargetUser_HasTargetUsername()
    {
        fixture.EnsureTestUserExists();
        // MakeEntry sets TargetUserId = ApiFixture.TestUserId (testuser)
        var uniqueAction = $"target_test_{Guid.NewGuid():N}";
        await InsertAuditEntriesAsync(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            ActionType = uniqueAction,
            ActorUserId = ApiFixture.AdminUserId,
            TargetUserId = ApiFixture.TestUserId,
            IpAddress = "127.0.0.1",
            Timestamp = DateTime.UtcNow
        });

        var client = fixture.CreateAuthenticatedAdminClient();
        var response = await client.GetAsync($"/api/admin/audit-log?actionType={uniqueAction}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var entry = body.GetProperty("entries")[0];

        Assert.True(entry.TryGetProperty("actorUsername", out var actorUsername));
        Assert.Equal("adminuser", actorUsername.GetString());

        Assert.True(entry.TryGetProperty("targetUsername", out var targetUsername));
        Assert.Equal("testuser", targetUsername.GetString());
    }

    [Fact]
    public async Task GetAuditLog_EntryWithNoTargetUser_HasNullTargetUsername()
    {
        fixture.EnsureTestUserExists();
        var uniqueAction = $"no_target_{Guid.NewGuid():N}";
        await InsertAuditEntriesAsync(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            ActionType = uniqueAction,
            ActorUserId = ApiFixture.AdminUserId,
            TargetUserId = null,
            IpAddress = "127.0.0.1",
            Timestamp = DateTime.UtcNow
        });

        var client = fixture.CreateAuthenticatedAdminClient();
        var response = await client.GetAsync($"/api/admin/audit-log?actionType={uniqueAction}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var entry = body.GetProperty("entries")[0];

        Assert.True(entry.TryGetProperty("targetUsername", out var targetUsername));
        Assert.Equal(JsonValueKind.Null, targetUsername.ValueKind);
    }
}
