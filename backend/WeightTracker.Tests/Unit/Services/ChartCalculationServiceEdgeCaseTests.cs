using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Domain.Models;
using WeightTracker.Infrastructure.Services; // doesn't exist yet — will fail to compile
using Xunit;

namespace WeightTracker.Tests.Unit.Services;

public class ChartCalculationServiceEdgeCaseTests
{
    private static readonly Guid DefaultUserId = new("00000000-0000-0000-0000-000000000001");

    // ── Stub repositories ────────────────────────────────────────────────────

    private class StubWeightEntryRepo : IWeightEntryRepository
    {
        private readonly List<WeightEntry> _entries;
        public StubWeightEntryRepo(List<WeightEntry> entries) => _entries = entries;
        public Task<List<WeightEntry>> GetAllAsync(Guid userId)
            => Task.FromResult(_entries);
        public Task<(WeightEntry Entry, AddOutcome Outcome)> AddAsync(WeightEntry e) => Task.FromResult((e, AddOutcome.Inserted));
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
    public async Task SingleEntry_WithGoal_ReturnsCalibratingState()
    {
        var entries = new List<WeightEntry>
        {
            MakeEntry(72m, "kg", "2026-03-01T08:00:00Z"),
        };

        var svc = BuildService(entries, DefaultSettings());

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        Assert.Equal("calibrating", result.CorridorState);
        Assert.Null(result.Floor);
        Assert.Null(result.Ceiling);
        Assert.Null(result.Ideal);
    }

    [Fact]
    public async Task SingleEntry_WithoutGoal_ReturnsNoGoalState()
    {
        var entries = new List<WeightEntry>
        {
            MakeEntry(72m, "kg", "2026-03-01T08:00:00Z"),
        };

        var settingsNoGoal = DefaultSettings();
        settingsNoGoal.WeightGoal = null;

        var svc = BuildService(entries, settingsNoGoal);

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        Assert.Equal("no-goal", result.CorridorState);
        Assert.Null(result.Floor);
        Assert.Null(result.Ceiling);
        Assert.Null(result.Ideal);
    }

    [Fact]
    public async Task AllEntriesOnOneCalendarDay_FiveEntries_ProducesOneAveragedDataPoint_AndCalibratingState()
    {
        // All five entries are on the same UTC calendar day
        var entries = new List<WeightEntry>
        {
            MakeEntry(70m, "kg", "2026-03-01T06:00:00Z"),
            MakeEntry(71m, "kg", "2026-03-01T09:00:00Z"),
            MakeEntry(72m, "kg", "2026-03-01T12:00:00Z"),
            MakeEntry(73m, "kg", "2026-03-01T15:00:00Z"),
            MakeEntry(74m, "kg", "2026-03-01T18:00:00Z"),
        };

        var svc = BuildService(entries, DefaultSettings());

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        // Only 1 distinct calendar day → calibrating
        Assert.Equal("calibrating", result.CorridorState);
        Assert.Single(result.DataPoints);

        // Mean of 70+71+72+73+74 = 360/5 = 72
        Assert.Equal(72m, result.DataPoints[0].Value);

        Assert.Null(result.Floor);
        Assert.Null(result.Ceiling);
        Assert.Null(result.Ideal);
    }

    [Fact]
    public async Task WeightGoalEqualsCurrentAverage_WithSevenOrMoreDays_CorridorsAreStillComputed()
    {
        // The goal (70 kg) happens to equal the measured average — corridors should still be computed.
        var entries = Enumerable.Range(0, 7)
            .Select(i => MakeEntry(70m, "kg",
                new DateTime(2026, 3, 1, 8, 0, 0, DateTimeKind.Utc)
                    .AddDays(i)
                    .ToString("O")))
            .ToList();

        var settings = DefaultSettings();
        settings.WeightGoal = 70m; // equals the average

        var svc = BuildService(entries, settings);

        var result = await svc.ComputeChartDataAsync(DefaultUserId, "kg");

        Assert.Equal("ready", result.CorridorState);
        Assert.NotNull(result.Floor);
        Assert.NotNull(result.Ceiling);
        Assert.NotNull(result.Ideal);
    }

    [Fact]
    public async Task ManyEntries_120DaysOnePerDay_ReturnsReadyWithAllCorridorsAndSufficientDataPoints()
    {
        // Generate 120 entries, one per day from 2025-11-01
        var baseDate = new DateTime(2025, 11, 1, 8, 0, 0, DateTimeKind.Utc);
        var entries = Enumerable.Range(0, 120)
            .Select(i => MakeEntry(75m - i * 0.05m, "kg",
                baseDate.AddDays(i).ToString("O")))
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
        Assert.True(result.DataPoints.Count >= 7,
            $"Expected at least 7 dataPoints but got {result.DataPoints.Count}");
    }
}
