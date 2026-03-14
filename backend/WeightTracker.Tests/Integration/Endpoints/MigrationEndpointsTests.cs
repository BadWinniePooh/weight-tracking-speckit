using System.Net;
using System.Net.Http.Json;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class MigrationEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    // ── POST /api/migrate ────────────────────────────────────────────────────────

    [Fact]
    public async Task Migrate_HappyPath_Returns200WithCorrectCounts()
    {
        // Arrange: 5 valid entries + settings
        var entries = new List<MigrateEntryDto>
        {
            new(Guid.NewGuid(), 70.0m, "kg", "2025-01-01T08:00:00Z"),
            new(Guid.NewGuid(), 70.5m, "kg", "2025-01-02T08:00:00Z"),
            new(Guid.NewGuid(), 71.0m, "kg", "2025-01-03T08:00:00Z"),
            new(Guid.NewGuid(), 71.5m, "kg", "2025-01-04T08:00:00Z"),
            new(Guid.NewGuid(), 72.0m, "kg", "2025-01-05T08:00:00Z"),
        };
        var settings = new MigrateSettingsDto("kg", null, 0.0055m, 0.6m, 0.0075m);
        var request = new MigrateRequest(entries, settings);

        // Act
        var response = await _client.PostAsJsonAsync("/api/migrate", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<MigrateResponse>();
        Assert.NotNull(body);
        Assert.Equal(5, body.MigratedEntries);
        Assert.Equal(0, body.SkippedEntries);
        Assert.True(body.SettingsMigrated);
        Assert.Empty(body.SkippedReasons);
    }

    [Fact]
    public async Task Migrate_PartialFailure_SkipsInvalidEntry()
    {
        // Arrange: 2 valid + 1 invalid (weight 9999 kg exceeds max)
        var entries = new List<MigrateEntryDto>
        {
            new(Guid.NewGuid(), 70.0m, "kg", "2025-02-01T08:00:00Z"),
            new(Guid.NewGuid(), 71.0m, "kg", "2025-02-02T08:00:00Z"),
            new(Guid.NewGuid(), 9999m, "kg", "2025-02-03T08:00:00Z"),
        };
        var request = new MigrateRequest(entries, null);

        // Act
        var response = await _client.PostAsJsonAsync("/api/migrate", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<MigrateResponse>();
        Assert.NotNull(body);
        Assert.Equal(2, body.MigratedEntries);
        Assert.Equal(1, body.SkippedEntries);
        Assert.False(body.SettingsMigrated);
        Assert.Single(body.SkippedReasons);
    }

    [Fact]
    public async Task Migrate_Idempotency_SecondSubmitCountsAsSkipped()
    {
        // Arrange: 5 valid entries submitted twice
        var entries = new List<MigrateEntryDto>
        {
            new(Guid.NewGuid(), 68.0m, "kg", "2025-03-01T08:00:00Z"),
            new(Guid.NewGuid(), 68.5m, "kg", "2025-03-02T08:00:00Z"),
            new(Guid.NewGuid(), 69.0m, "kg", "2025-03-03T08:00:00Z"),
            new(Guid.NewGuid(), 69.5m, "kg", "2025-03-04T08:00:00Z"),
            new(Guid.NewGuid(), 70.0m, "kg", "2025-03-05T08:00:00Z"),
        };
        var settings = new MigrateSettingsDto("kg", null, 0.0055m, 0.6m, 0.0075m);
        var request = new MigrateRequest(entries, settings);

        // First submission
        var firstResponse = await _client.PostAsJsonAsync("/api/migrate", request);
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

        // Act: second submission with identical data
        var secondResponse = await _client.PostAsJsonAsync("/api/migrate", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
        var body = await secondResponse.Content.ReadFromJsonAsync<MigrateResponse>();
        Assert.NotNull(body);
        Assert.Equal(0, body.MigratedEntries);
        Assert.Equal(5, body.SkippedEntries);
        Assert.True(body.SettingsMigrated);
    }

    [Fact]
    public async Task Migrate_EmptyEntries_NoSettings_Returns200WithZeroCounts()
    {
        // Arrange
        var request = new MigrateRequest(new List<MigrateEntryDto>(), null);

        // Act
        var response = await _client.PostAsJsonAsync("/api/migrate", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<MigrateResponse>();
        Assert.NotNull(body);
        Assert.Equal(0, body.MigratedEntries);
        Assert.Equal(0, body.SkippedEntries);
        Assert.False(body.SettingsMigrated);
    }

    [Fact]
    public async Task Migrate_MissingEntriesField_Returns400()
    {
        // Arrange: send {} (no "entries" field)
        var response = await _client.PostAsJsonAsync("/api/migrate", new { });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}

// ── Request / Response DTOs (test-local) ─────────────────────────────────────

record MigrateRequest(
    List<MigrateEntryDto>? Entries,
    MigrateSettingsDto? Settings);

record MigrateEntryDto(Guid Id, decimal WeightValue, string Unit, string Timestamp);

record MigrateSettingsDto(string PreferredUnit, decimal? WeightGoal, decimal LossRate, decimal CarbFatRatio, decimal BufferValue);

record MigrateResponse(int MigratedEntries, int SkippedEntries, bool SettingsMigrated, List<string> SkippedReasons);
