using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Domain.Models;

namespace WeightTracker.Infrastructure.Services;

public class ChartCalculationService(
    IWeightEntryRepository weightEntryRepo,
    IChartSettingsRepository chartSettingsRepo) : IChartCalculationService
{
    public async Task<ChartDataSet> ComputeChartDataAsync(Guid userId, string unit)
    {
        var entries = await weightEntryRepo.GetAllAsync(userId);
        var settings = await chartSettingsRepo.GetByUserAsync(userId);

        var empty = new ChartDataSet
        {
            CorridorState = "no-data",
            Unit = unit,
            DataPoints = new List<ChartPoint>(),
            Trendline = null,
            Floor = null,
            Ceiling = null,
            Ideal = null,
        };

        if (entries == null || entries.Count == 0)
            return empty;

        var allDailyAverages = BuildDailyAverages(entries, unit);
        var measured = allDailyAverages.Where(d => d.Origin == DailyAverageOrigin.Measured).ToList();

        // DataPoints = all daily averages (including interpolated)
        var dataPoints = allDailyAverages
            .Select(d => new ChartPoint { Date = d.Date, Value = d.AvgWeight })
            .ToList();

        var trendline = ComputeTrendline(measured);

        var maxMeasuredDayIndex = measured.Count > 0 ? measured[measured.Count - 1].DayIndex : 0;

        string corridorState;
        List<ChartPoint>? floor = null;
        List<ChartPoint>? ceiling = null;
        List<ChartPoint>? ideal = null;

        if (settings == null || settings.WeightGoal == null)
        {
            corridorState = settings == null ? "no-goal" : "no-goal";
        }
        else if (maxMeasuredDayIndex < 6)
        {
            corridorState = "calibrating";
        }
        else
        {
            var corridor = ComputeCorridorLines(allDailyAverages, settings, unit);
            if (corridor != null)
            {
                corridorState = "ready";
                floor = corridor.Value.floor;
                ceiling = corridor.Value.ceiling;
                ideal = corridor.Value.ideal;
            }
            else
            {
                corridorState = "calibrating";
            }
        }

        return new ChartDataSet
        {
            CorridorState = corridorState,
            Unit = unit,
            DataPoints = dataPoints,
            Trendline = trendline,
            Floor = floor,
            Ceiling = ceiling,
            Ideal = ideal,
        };
    }

    // ── Unit conversion ──────────────────────────────────────────────────────

    private static decimal ToUnit(decimal value, string fromUnit, string toUnit)
    {
        if (fromUnit == toUnit) return value;
        if (fromUnit == "kg" && toUnit == "lbs") return value * 2.20462m;
        return value * 0.453592m; // lbs → kg
    }

    // ── Calendar day key (UTC) ───────────────────────────────────────────────

    private static string CalendarDayKey(DateTime date)
    {
        var utc = date.Kind == DateTimeKind.Utc ? date : date.ToUniversalTime();
        return $"{utc.Year}-{utc.Month}-{utc.Day}";
    }

    private static DateTime UtcDayStart(DateTime date)
    {
        var utc = date.Kind == DateTimeKind.Utc ? date : date.ToUniversalTime();
        return new DateTime(utc.Year, utc.Month, utc.Day, 0, 0, 0, DateTimeKind.Utc);
    }

    // ── BuildDailyAverages ───────────────────────────────────────────────────

    private static List<DailyAverage> BuildDailyAverages(List<WeightEntry> entries, string preferredUnit)
    {
        if (entries == null || entries.Count == 0) return new List<DailyAverage>();

        // Group by UTC calendar day
        var byDay = new Dictionary<string, (DateTime date, decimal total, int count)>();
        foreach (var entry in entries)
        {
            var key = CalendarDayKey(entry.Timestamp);
            var converted = ToUnit(entry.WeightValue, entry.Unit, preferredUnit);
            if (byDay.TryGetValue(key, out var existing))
            {
                byDay[key] = (existing.date, existing.total + converted, existing.count + 1);
            }
            else
            {
                byDay[key] = (UtcDayStart(entry.Timestamp), converted, 1);
            }
        }

        // Sort ascending by date
        var sorted = byDay.Values.OrderBy(v => v.date).ToList();
        if (sorted.Count == 0) return new List<DailyAverage>();

        var baseTime = sorted[0].date;
        const double msDayD = 86400000.0;

        var measured = sorted.Select(day =>
        {
            var diffMs = (day.date - baseTime).TotalMilliseconds;
            var dayIndex = (int)Math.Round(diffMs / msDayD);
            return new DailyAverage
            {
                Date = day.date.ToString("yyyy-MM-dd"),
                DayIndex = dayIndex,
                AvgWeight = day.total / day.count,
                Origin = DailyAverageOrigin.Measured,
            };
        }).ToList();

        // Gap interpolation for interior missing days
        if (measured.Count < 2) return measured;

        var maxDayIndex = measured[measured.Count - 1].DayIndex;
        var result = new List<DailyAverage>();
        int mi = 0;

        for (int d = 0; d <= maxDayIndex; d++)
        {
            if (measured[mi].DayIndex == d)
            {
                result.Add(measured[mi]);
                mi++;
            }
            else
            {
                // Interpolate between surrounding measured entries
                var prev = measured[mi - 1];
                var next = measured[mi];
                var t = (decimal)(d - prev.DayIndex) / (decimal)(next.DayIndex - prev.DayIndex);
                var interpolatedWeight = prev.AvgWeight + (next.AvgWeight - prev.AvgWeight) * t;
                var interpolatedDate = baseTime.AddDays(d);
                result.Add(new DailyAverage
                {
                    Date = interpolatedDate.ToString("yyyy-MM-dd"),
                    DayIndex = d,
                    AvgWeight = interpolatedWeight,
                    Origin = DailyAverageOrigin.Interpolated,
                });
            }
        }

        return result;
    }

    // ── ComputeTrendline ─────────────────────────────────────────────────────

    private static List<ChartPoint>? ComputeTrendline(List<DailyAverage> measured)
    {
        if (measured == null || measured.Count < 2) return null;

        var n = measured.Count;
        var xMean = measured.Average(d => (decimal)d.DayIndex);
        var yMean = measured.Average(d => d.AvgWeight);

        var ssXX = measured.Sum(d => (d.DayIndex - xMean) * (d.DayIndex - xMean));
        if (ssXX == 0) return null; // all same dayIndex

        var ssXY = measured.Sum(d => (d.DayIndex - xMean) * (d.AvgWeight - yMean));
        var slope = ssXY / ssXX;
        var intercept = yMean - slope * xMean;

        decimal TrendY(int xi) => slope * xi + intercept;

        return new List<ChartPoint>
        {
            new ChartPoint { Date = measured[0].Date, Value = TrendY(measured[0].DayIndex) },
            new ChartPoint { Date = measured[n - 1].Date, Value = TrendY(measured[n - 1].DayIndex) },
        };
    }

    // ── ComputeCorridorLines ─────────────────────────────────────────────────

    private static (List<ChartPoint> floor, List<ChartPoint> ceiling, List<ChartPoint> ideal)?
        ComputeCorridorLines(List<DailyAverage> allDailyAverages, ChartSettings settings, string unit)
    {
        if (settings.WeightGoal == null) return null;

        var measured = allDailyAverages.Where(d => d.Origin == DailyAverageOrigin.Measured).ToList();
        var maxMeasuredDayIndex = measured.Count > 0 ? measured[measured.Count - 1].DayIndex : 0;
        if (maxMeasuredDayIndex < 6) return null;

        // Convert goal to the output unit
        var weightGoal = ToUnit(settings.WeightGoal.Value, settings.PreferredUnit, unit);
        var lossRate = settings.LossRate;
        var carbFatRatio = settings.CarbFatRatio;
        var bufferValue = settings.BufferValue;

        // Calibration: average of measured entries in dayIndex 0–5
        var calibrationEntries = measured.Where(d => d.DayIndex <= 5).ToList();
        decimal startValue;
        if (calibrationEntries.Count > 0)
        {
            startValue = calibrationEntries.Average(d => d.AvgWeight);
        }
        else
        {
            startValue = measured[0].AvgWeight;
        }

        var adjustedGoal = weightGoal + weightGoal * bufferValue;

        var floor = new List<ChartPoint>();
        var ceiling = new List<ChartPoint>();
        var ideal = new List<ChartPoint>();

        var corridorDays = allDailyAverages.Where(d => d.DayIndex >= 6).ToList();
        var prevFloor = startValue - startValue * bufferValue * 0.5m;
        var prevCeiling = startValue + startValue * bufferValue * 0.5m;
        bool firstDay = true;

        foreach (var day in corridorDays)
        {
            decimal f, c;
            if (firstDay)
            {
                f = prevFloor;
                c = prevCeiling;
                firstDay = false;
            }
            else
            {
                f = prevFloor - (prevFloor - weightGoal) * lossRate;
                c = prevCeiling - (prevCeiling - adjustedGoal) * lossRate * carbFatRatio;
            }
            floor.Add(new ChartPoint { Date = day.Date, Value = f });
            ceiling.Add(new ChartPoint { Date = day.Date, Value = c });
            ideal.Add(new ChartPoint { Date = day.Date, Value = (f + c) / 2m });
            prevFloor = f;
            prevCeiling = c;
        }

        if (floor.Count == 0) return null;
        return (floor, ceiling, ideal);
    }
}
