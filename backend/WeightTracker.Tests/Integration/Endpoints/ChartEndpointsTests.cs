using System.Net;
using System.Net.Http.Json;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class ChartEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateAuthenticatedClient();

    // ── Local DTOs ───────────────────────────────────────────────────────────

    record ChartResponse(
        string CorridorState,
        string Unit,
        List<ChartPointDto> DataPoints,
        List<ChartPointDto>? Trendline,
        List<ChartPointDto>? Floor,
        List<ChartPointDto>? Ceiling,
        List<ChartPointDto>? Ideal);

    record ChartPointDto(string Date, decimal Value);

    // ── Seed helpers ─────────────────────────────────────────────────────────

    private async Task SeedEntry(decimal weight, string unit, string timestamp)
    {
        var response = await _client.PostAsJsonAsync("/api/entries",
            new { WeightValue = weight, Unit = unit, Timestamp = timestamp });
        response.EnsureSuccessStatusCode();
    }

    private async Task SeedSettings(
        string preferredUnit = "kg",
        decimal? weightGoal = null,
        decimal lossRate = 0.0055m,
        decimal carbFatRatio = 0.6m,
        decimal bufferValue = 0.0075m)
    {
        var body = new
        {
            PreferredUnit = preferredUnit,
            WeightGoal = weightGoal,
            LossRate = lossRate,
            CarbFatRatio = carbFatRatio,
            BufferValue = bufferValue
        };
        var response = await _client.PutAsJsonAsync("/api/settings", body);
        response.EnsureSuccessStatusCode();
    }

    private async Task ClearEntries()
    {
        await _client.DeleteAsync("/api/entries");
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetChart_FreshDatabase_ReturnsNoDataState()
    {
        await ClearEntries();

        var response = await _client.GetAsync("/api/chart");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ChartResponse>();
        Assert.NotNull(body);
        Assert.Equal("no-data", body.CorridorState);
        Assert.Empty(body.DataPoints);
    }

    [Fact]
    public async Task GetChart_EntriesExistButNoGoal_ReturnsNoGoalState()
    {
        await ClearEntries();
        await SeedEntry(70m, "kg", "2026-03-01T08:00:00Z");
        await SeedEntry(70.5m, "kg", "2026-03-02T08:00:00Z");
        await SeedEntry(71m, "kg", "2026-03-03T08:00:00Z");
        await SeedSettings(preferredUnit: "kg", weightGoal: null);

        var response = await _client.GetAsync("/api/chart");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ChartResponse>();
        Assert.NotNull(body);
        Assert.Equal("no-goal", body.CorridorState);
        Assert.Equal(3, body.DataPoints.Count);
        Assert.Null(body.Floor);
        Assert.Null(body.Ceiling);
        Assert.Null(body.Ideal);
    }

    [Fact]
    public async Task GetChart_FourDistinctDaysWithGoal_ReturnsCalibratingState()
    {
        await ClearEntries();
        await SeedEntry(72m, "kg", "2026-03-01T08:00:00Z");
        await SeedEntry(71.5m, "kg", "2026-03-02T08:00:00Z");
        await SeedEntry(71m, "kg", "2026-03-03T08:00:00Z");
        await SeedEntry(70.5m, "kg", "2026-03-04T08:00:00Z");
        await SeedSettings(preferredUnit: "kg", weightGoal: 70m);

        var response = await _client.GetAsync("/api/chart");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ChartResponse>();
        Assert.NotNull(body);
        Assert.Equal("calibrating", body.CorridorState);
        Assert.Null(body.Floor);
        Assert.Null(body.Ceiling);
        Assert.Null(body.Ideal);
    }

    [Fact]
    public async Task GetChart_TenDistinctDaysWithGoal_ReturnsReadyStateWithAllCorridors()
    {
        await ClearEntries();

        var baseDate = new DateTime(2026, 3, 1, 8, 0, 0, DateTimeKind.Utc);
        for (int i = 0; i < 10; i++)
        {
            await SeedEntry(72m - i * 0.2m, "kg", baseDate.AddDays(i).ToString("O"));
        }

        await SeedSettings(preferredUnit: "kg", weightGoal: 68m);

        var response = await _client.GetAsync("/api/chart");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ChartResponse>();
        Assert.NotNull(body);
        Assert.Equal("ready", body.CorridorState);
        Assert.NotNull(body.Floor);
        Assert.NotEmpty(body.Floor);
        Assert.NotNull(body.Ceiling);
        Assert.NotEmpty(body.Ceiling);
        Assert.NotNull(body.Ideal);
        Assert.NotEmpty(body.Ideal);
    }

    [Fact]
    public async Task GetChart_EntriesInKgWithLbsPreference_ReturnsValuesConvertedToLbs()
    {
        await ClearEntries();
        const decimal storedKg = 70m;
        await SeedEntry(storedKg, "kg", "2026-03-01T08:00:00Z");
        await SeedSettings(preferredUnit: "lbs", weightGoal: null);

        var response = await _client.GetAsync("/api/chart");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ChartResponse>();
        Assert.NotNull(body);
        Assert.Equal("lbs", body.Unit);
        Assert.NotEmpty(body.DataPoints);

        var expectedLbs = storedKg * 2.20462m;
        Assert.True(
            Math.Abs(body.DataPoints[0].Value - expectedLbs) < 0.1m,
            $"Expected value ~{expectedLbs} lbs but got {body.DataPoints[0].Value}");
    }
}
