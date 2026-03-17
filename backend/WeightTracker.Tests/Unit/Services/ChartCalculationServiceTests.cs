using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Domain.Models;
using WeightTracker.Infrastructure.Services; // doesn't exist yet — will fail to compile
using Xunit;

namespace WeightTracker.Tests.Unit.Services;

public class ChartCalculationServiceTests
{
    private static readonly Guid DefaultUserId = new("00000000-0000-0000-0000-000000000001");

    // ── Stub repositories ────────────────────────────────────────────────────

    private class StubWeightEntryRepo : IWeightEntryRepository
    {
        private readonly List<WeightEntry> _entries;
        public StubWeightEntryRepo(List<WeightEntry> entries) => _entries = entries;
        public Task<List<WeightEntry>> GetAllAsync(Guid userId)
            => Task.FromResult(_entries);
        public Task<(WeightEntry Entry, bool WasInserted)> AddAsync(WeightEntry e) => Task.FromResult((e, true));
        public Task<int> AddRangeAsync(IEnumerable<WeightEntry> entries) => Task.FromResult(0);
        public Task<bool> DeleteAsync(Guid id, Guid userId) => Task.FromResult(true);
        public Task DeleteAllAsync(Guid userId) => Task.CompletedTask;
    }

    private class StubChartSettingsRepo : IChartSettingsRepository
    {
        private readonly ChartSettings? _settings;
        public StubChartSettingsRepo(ChartSettings? settings) => _settings = settings;
        public Task<ChartSettings?> GetByUserAsync(Guid userId)
            => Task.FromResult(_settings);
        public Task<ChartSettings> UpsertAsync(ChartSettings s) => Task.FromResult(s);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static WeightEntry MakeEntry(decimal value, string unit, string dateStr)
        => new()
        {
            Id = Guid.NewGuid(),
            UserId = DefaultUserId,
            WeightValue = value,
            Unit = unit,
            Timestamp = DateTime.Parse(dateStr, null, System.Globalization.DateTimeStyles.RoundtripKind),
            CreatedAt = DateTime.UtcNow
        };

    private static ChartSettings DefaultSettings() => new()
    {
        Id = Guid.NewGuid(),
        UserId = DefaultUserId,
        PreferredUnit = "kg",
        WeightGoal = 70m,
        LossRate = 0.0055m,
        CarbFatRatio = 0.6m,
        BufferValue = 0.0075m,
        UpdatedAt = DateTime.UtcNow
    };

    private static IChartCalculationService BuildService(
        List<WeightEntry> entries,
        ChartSettings? settings)
    {
        return new ChartCalculationService(
            new StubWeightEntryRepo(entries),
            new StubChartSettingsRepo(settings));
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task NoData_WhenNoEntriesExist_ReturnsNoDataState()
    {
        var svc = BuildService(new List<WeightEntry>(), settings: null);

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        Assert.Equal("no-data", result.CorridorState);
        Assert.Empty(result.DataPoints);
        Assert.Null(result.Trendline);
        Assert.Null(result.Floor);
        Assert.Null(result.Ceiling);
        Assert.Null(result.Ideal);
    }

    [Fact]
    public async Task NoGoal_WhenEntriesExistButGoalIsNull_ReturnsNoGoalState()
    {
        var settingsNoGoal = DefaultSettings();
        settingsNoGoal.WeightGoal = null;

        var entries = new List<WeightEntry>
        {
            MakeEntry(70m, "kg", "2026-03-01T08:00:00Z"),
            MakeEntry(70.5m, "kg", "2026-03-02T08:00:00Z"),
            MakeEntry(71m, "kg", "2026-03-03T08:00:00Z"),
        };

        var svc = BuildService(entries, settingsNoGoal);

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        Assert.Equal("no-goal", result.CorridorState);
        Assert.NotEmpty(result.DataPoints);
        Assert.Null(result.Floor);
        Assert.Null(result.Ceiling);
        Assert.Null(result.Ideal);
    }

    [Fact]
    public async Task Calibrating_WhenGoalSetButFewerThanSevenDistinctDays_ReturnsCalibratingState()
    {
        // Only 3 distinct calendar days — not enough to reach "ready"
        var entries = new List<WeightEntry>
        {
            MakeEntry(72m, "kg", "2026-03-01T08:00:00Z"),
            MakeEntry(71.5m, "kg", "2026-03-02T08:00:00Z"),
            MakeEntry(71m, "kg", "2026-03-03T08:00:00Z"),
        };

        var svc = BuildService(entries, DefaultSettings());

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        Assert.Equal("calibrating", result.CorridorState);
        Assert.Null(result.Floor);
        Assert.Null(result.Ceiling);
        Assert.Null(result.Ideal);
    }

    [Fact]
    public async Task Ready_WhenGoalSetAndAtLeastSevenDistinctDays_ReturnsReadyStateWithAllCorridors()
    {
        // 8 distinct calendar days — enough for "ready"
        var entries = Enumerable.Range(0, 8)
            .Select(i => MakeEntry(72m - i * 0.1m, "kg",
                new DateTime(2026, 3, 1, 8, 0, 0, DateTimeKind.Utc)
                    .AddDays(i)
                    .ToString("O")))
            .ToList();

        var svc = BuildService(entries, DefaultSettings());

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        Assert.Equal("ready", result.CorridorState);
        Assert.NotNull(result.Floor);
        Assert.NotEmpty(result.Floor);
        Assert.NotNull(result.Ceiling);
        Assert.NotEmpty(result.Ceiling);
        Assert.NotNull(result.Ideal);
        Assert.NotEmpty(result.Ideal);
        Assert.NotNull(result.Trendline);
        Assert.NotEmpty(result.Trendline);
    }

    [Fact]
    public async Task UnitConversion_KgToLbs_DataPointValuesAreMultipliedByFactor()
    {
        const decimal storedKg = 70m;
        var entries = new List<WeightEntry>
        {
            MakeEntry(storedKg, "kg", "2026-03-01T08:00:00Z"),
        };

        // Settings use "kg" storage but we request "lbs"
        var svc = BuildService(entries, DefaultSettings());

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "lbs");

        Assert.Equal("lbs", result.Unit);
        Assert.NotEmpty(result.DataPoints);
        var expectedLbs = storedKg * 2.20462m;
        Assert.True(
            Math.Abs(result.DataPoints[0].Value - expectedLbs) < 0.01m,
            $"Expected ~{expectedLbs} lbs but got {result.DataPoints[0].Value}");
    }

    [Fact]
    public async Task UnitConversion_LbsToKg_DataPointValuesAreMultipliedByFactor()
    {
        const decimal storedLbs = 154m;
        var entries = new List<WeightEntry>
        {
            MakeEntry(storedLbs, "lbs", "2026-03-01T08:00:00Z"),
        };

        var settings = DefaultSettings();
        settings.PreferredUnit = "lbs";

        var svc = BuildService(entries, settings);

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        Assert.Equal("kg", result.Unit);
        Assert.NotEmpty(result.DataPoints);
        var expectedKg = storedLbs * 0.453592m;
        Assert.True(
            Math.Abs(result.DataPoints[0].Value - expectedKg) < 0.01m,
            $"Expected ~{expectedKg} kg but got {result.DataPoints[0].Value}");
    }

    [Fact]
    public async Task DailyAveraging_TwoEntriesOnSameCalendarDay_ProducesOneDataPointWithMean()
    {
        // Two entries on 2026-03-01 (different times)
        var entries = new List<WeightEntry>
        {
            MakeEntry(70m, "kg", "2026-03-01T07:00:00Z"),
            MakeEntry(72m, "kg", "2026-03-01T19:00:00Z"),
        };

        var svc = BuildService(entries, DefaultSettings());

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        // Should collapse to a single data point for that day
        Assert.Single(result.DataPoints);
        Assert.Equal(71m, result.DataPoints[0].Value); // mean of 70 and 72
    }

    [Fact]
    public async Task GapInterpolation_MissingDayBetweenTwoMeasuredDays_InterpolatedPointIncluded()
    {
        // Day 0 = 70kg, Day 2 = 72kg — Day 1 should be interpolated to 71kg
        var entries = new List<WeightEntry>
        {
            MakeEntry(70m, "kg", "2026-03-01T08:00:00Z"),
            MakeEntry(72m, "kg", "2026-03-03T08:00:00Z"),
        };

        var svc = BuildService(entries, DefaultSettings());

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        // Should have 3 data points: day 0, interpolated day 1, day 2
        Assert.Equal(3, result.DataPoints.Count);
        var march2 = result.DataPoints.FirstOrDefault(p => p.Date.StartsWith("2026-03-02"));
        Assert.NotNull(march2);
        Assert.True(
            Math.Abs(march2.Value - 71m) < 0.01m,
            $"Expected interpolated value ~71 but got {march2.Value}");
    }
}
