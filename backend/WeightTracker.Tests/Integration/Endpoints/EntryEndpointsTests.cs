using System.Net;
using System.Net.Http.Json;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class EntryEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateAuthenticatedClient();

    // ── GET /api/entries ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetEntries_WhenNoEntries_ReturnsEmptyArray()
    {
        var response = await _client.GetAsync("/api/entries");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<EntryListResponse>();
        Assert.NotNull(body);
        Assert.Empty(body.Entries);
    }

    [Fact]
    public async Task GetEntries_WhenEntriesExist_ReturnsNewestFirst()
    {
        // Arrange: post two entries
        var older = new CreateEntryRequest(70.0m, "kg", "2026-03-01T08:00:00Z");
        var newer = new CreateEntryRequest(71.0m, "kg", "2026-03-02T08:00:00Z");
        await _client.PostAsJsonAsync("/api/entries", older);
        await _client.PostAsJsonAsync("/api/entries", newer);

        var response = await _client.GetAsync("/api/entries");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<EntryListResponse>();
        Assert.NotNull(body);
        Assert.True(body.Entries.Count >= 2);
        // Newest first
        Assert.True(
            string.Compare(body.Entries[0].Timestamp, body.Entries[1].Timestamp, StringComparison.Ordinal) >= 0,
            "Entries should be returned newest-first");
    }

    // ── POST /api/entries ───────────────────────────────────────────────────────

    [Fact]
    public async Task PostEntry_ValidKg_Returns201WithEntry()
    {
        var request = new CreateEntryRequest(75.5m, "kg", "2026-03-10T09:00:00Z");

        var response = await _client.PostAsJsonAsync("/api/entries", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<EntryResponse>();
        Assert.NotNull(body);
        Assert.NotEqual(Guid.Empty, body.Id);
        Assert.Equal(75.5m, body.WeightValue);
        Assert.Equal("kg", body.Unit);
    }

    [Fact]
    public async Task PostEntry_ValidLbs_Returns201WithEntry()
    {
        var request = new CreateEntryRequest(165.0m, "lbs", "2026-03-10T10:00:00Z");

        var response = await _client.PostAsJsonAsync("/api/entries", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<EntryResponse>();
        Assert.NotNull(body);
        Assert.Equal("lbs", body.Unit);
    }

    [Fact]
    public async Task PostEntry_WeightTooHighForKg_Returns400()
    {
        var request = new CreateEntryRequest(636m, "kg", "2026-03-10T11:00:00Z");

        var response = await _client.PostAsJsonAsync("/api/entries", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
    }

    [Fact]
    public async Task PostEntry_WeightTooLowForKg_Returns400()
    {
        var request = new CreateEntryRequest(0m, "kg", "2026-03-10T11:00:00Z");

        var response = await _client.PostAsJsonAsync("/api/entries", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostEntry_WeightTooHighForLbs_Returns400()
    {
        var request = new CreateEntryRequest(1401m, "lbs", "2026-03-10T11:00:00Z");

        var response = await _client.PostAsJsonAsync("/api/entries", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostEntry_InvalidUnit_Returns400()
    {
        var request = new CreateEntryRequest(70m, "stone", "2026-03-10T11:00:00Z");

        var response = await _client.PostAsJsonAsync("/api/entries", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
    }

    [Fact]
    public async Task PostEntry_DuplicateId_Returns201WithExistingEntry()
    {
        var id = Guid.NewGuid();
        var request = new CreateEntryRequestWithId(id, 80m, "kg", "2026-03-11T08:00:00Z");

        var first = await _client.PostAsJsonAsync("/api/entries", request);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        // Submit same ID again with different value
        var duplicate = new CreateEntryRequestWithId(id, 99m, "kg", "2026-03-11T09:00:00Z");
        var second = await _client.PostAsJsonAsync("/api/entries", duplicate);

        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        var body = await second.Content.ReadFromJsonAsync<EntryResponse>();
        Assert.NotNull(body);
        // Original value preserved, not overwritten
        Assert.Equal(80m, body.WeightValue);
        Assert.Equal(id, body.Id);
    }

    // ── DELETE /api/entries/{id} ────────────────────────────────────────────────

    [Fact]
    public async Task DeleteEntry_ExistingId_Returns204()
    {
        var created = await CreateEntry(70m, "kg", "2026-03-12T08:00:00Z");

        var response = await _client.DeleteAsync($"/api/entries/{created.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteEntry_UnknownId_Returns404()
    {
        var response = await _client.DeleteAsync($"/api/entries/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
    }

    [Fact]
    public async Task DeleteEntry_AfterDeletion_NoLongerInList()
    {
        var created = await CreateEntry(72m, "kg", "2026-03-13T08:00:00Z");
        await _client.DeleteAsync($"/api/entries/{created.Id}");

        var list = await _client.GetFromJsonAsync<EntryListResponse>("/api/entries");
        Assert.DoesNotContain(list!.Entries, e => e.Id == created.Id);
    }

    // ── DELETE /api/entries ─────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAllEntries_WhenEntriesExist_Returns204AndEmptyList()
    {
        await CreateEntry(68m, "kg", "2026-03-14T08:00:00Z");
        await CreateEntry(69m, "kg", "2026-03-14T09:00:00Z");

        var deleteResponse = await _client.DeleteAsync("/api/entries");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var list = await _client.GetFromJsonAsync<EntryListResponse>("/api/entries");
        Assert.Empty(list!.Entries);
    }

    [Fact]
    public async Task DeleteAllEntries_WhenNoEntries_Returns204()
    {
        await _client.DeleteAsync("/api/entries"); // ensure empty
        var response = await _client.DeleteAsync("/api/entries");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private async Task<EntryResponse> CreateEntry(decimal weight, string unit, string timestamp)
    {
        var response = await _client.PostAsJsonAsync("/api/entries",
            new CreateEntryRequest(weight, unit, timestamp));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<EntryResponse>())!;
    }
}

// ── Request / Response DTOs (test-local) ────────────────────────────────────

record CreateEntryRequest(decimal WeightValue, string Unit, string Timestamp);
record CreateEntryRequestWithId(Guid Id, decimal WeightValue, string Unit, string Timestamp);
record EntryListResponse(List<EntryResponse> Entries);
record EntryResponse(Guid Id, decimal WeightValue, string Unit, string Timestamp);
record ErrorResponse(string? Error, string? Field);
