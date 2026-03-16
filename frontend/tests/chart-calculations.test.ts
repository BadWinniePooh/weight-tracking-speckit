import { describe, it, expect } from "vitest";
import {
  buildDailyAverages,
  computeTrendline,
  computeCorridorLines,
  computeChartData,
} from "../src/ts/chart-calculations";
import type { WeightEntry, ChartSettings } from "../src/ts/model";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a WeightEntry at noon UTC so the calendar date is stable across all timezones UTC-11..UTC+11. */
function makeEntry(
  id: string,
  date: string, // "YYYY-MM-DD"
  weightValue: number,
  unit: "kg" | "lbs" = "kg"
): WeightEntry {
  return { id, weightValue, unit, timestamp: `${date}T12:00:00.000Z` };
}

/** Create a minimal DailyAverage-shaped object for direct calls to computeTrendline / computeCorridorLines. */
function measured(dayIndex: number, avgWeight: number) {
  return {
    date: new Date(Date.UTC(2026, 0, dayIndex + 1)),
    dayIndex,
    avgWeight,
    origin: "measured" as const,
  };
}

function interpolated(dayIndex: number, avgWeight: number) {
  return {
    date: new Date(Date.UTC(2026, 0, dayIndex + 1)),
    dayIndex,
    avgWeight,
    origin: "interpolated" as const,
  };
}

const BASE_SETTINGS: ChartSettings = {
  preferredUnit: "kg",
  weightGoal: 75,
  lossRate: 0.0055,
  carbFatRatio: 0.6,
  bufferValue: 0.0075,
};

// ─── buildDailyAverages ───────────────────────────────────────────────────────

describe("buildDailyAverages", () => {
  it("returns [] for an empty entries array", () => {
    expect(buildDailyAverages([], "kg")).toEqual([]);
  });

  it("handles null/falsy entries without throwing", () => {
    // @ts-expect-error — testing the runtime guard
    expect(buildDailyAverages(null, "kg")).toEqual([]);
  });

  it("returns a single measured entry for one input entry", () => {
    const result = buildDailyAverages([makeEntry("e1", "2026-01-01", 100)], "kg");
    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe("measured");
    expect(result[0].dayIndex).toBe(0);
    expect(result[0].avgWeight).toBe(100);
  });

  it("averages multiple entries on the same calendar day", () => {
    const entries: WeightEntry[] = [
      { id: "a", weightValue: 100, unit: "kg", timestamp: "2026-01-01T08:00:00.000Z" },
      { id: "b", weightValue: 102, unit: "kg", timestamp: "2026-01-01T18:00:00.000Z" },
    ];
    const result = buildDailyAverages(entries, "kg");
    expect(result).toHaveLength(1);
    expect(result[0].avgWeight).toBe(101);
    expect(result[0].origin).toBe("measured");
  });

  it("three entries on the same day produce the arithmetic mean", () => {
    const entries: WeightEntry[] = [
      { id: "a", weightValue: 90, unit: "kg", timestamp: "2026-01-01T06:00:00.000Z" },
      { id: "b", weightValue: 95, unit: "kg", timestamp: "2026-01-01T12:00:00.000Z" },
      { id: "c", weightValue: 100, unit: "kg", timestamp: "2026-01-01T20:00:00.000Z" },
    ];
    const result = buildDailyAverages(entries, "kg");
    expect(result[0].avgWeight).toBeCloseTo(95, 10);
  });

  it("sorts daily entries ascending by date (oldest first)", () => {
    const entries = [
      makeEntry("new", "2026-01-03", 103),
      makeEntry("old", "2026-01-01", 100),
    ];
    const result = buildDailyAverages(entries, "kg");
    const meas = result.filter((d) => d.origin === "measured");
    expect(meas[0].avgWeight).toBe(100);
    expect(meas[1].avgWeight).toBe(103);
  });

  it("assigns dayIndex 0 to the earliest measurement", () => {
    const result = buildDailyAverages([makeEntry("e1", "2026-01-01", 100)], "kg");
    expect(result[0].dayIndex).toBe(0);
  });

  it("assigns dayIndex relative to first entry (4-day gap → dayIndex 4)", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-05", 110),
    ];
    const result = buildDailyAverages(entries, "kg");
    const meas = result.filter((d) => d.origin === "measured");
    expect(meas[0].dayIndex).toBe(0);
    expect(meas[1].dayIndex).toBe(4);
  });

  it("sets measured entry date to start-of-day (midnight)", () => {
    const result = buildDailyAverages([makeEntry("e1", "2026-01-01", 80)], "kg");
    const d = result[0].date as Date;
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("fills interior gaps with interpolated entries", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-04", 103),
    ];
    const result = buildDailyAverages(entries, "kg");
    // day 0 (measured), day 1 (interpolated), day 2 (interpolated), day 3 (measured)
    expect(result).toHaveLength(4);
    expect(result[0].origin).toBe("measured");
    expect(result[1].origin).toBe("interpolated");
    expect(result[2].origin).toBe("interpolated");
    expect(result[3].origin).toBe("measured");
  });

  it("interpolated day 1 of 3 has correct linear value", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-04", 103),
    ];
    const result = buildDailyAverages(entries, "kg");
    // dayIndex 1: t = 1/3, weight = 100 + 3 * (1/3) = 101
    expect(result[1].avgWeight).toBeCloseTo(101, 5);
  });

  it("interpolated day 2 of 3 has correct linear value", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-04", 103),
    ];
    const result = buildDailyAverages(entries, "kg");
    // dayIndex 2: t = 2/3, weight = 100 + 3 * (2/3) = 102
    expect(result[2].avgWeight).toBeCloseTo(102, 5);
  });

  it("interpolated dayIndex is correctly assigned", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-03", 102),
    ];
    const result = buildDailyAverages(entries, "kg");
    expect(result[1].dayIndex).toBe(1);
  });

  it("consecutive days produce no interpolated entries", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-02", 102),
    ];
    const result = buildDailyAverages(entries, "kg");
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.origin === "measured")).toBe(true);
  });

  it("interpolated value is correct when prev.dayIndex > 0 (non-zero prev)", () => {
    // 3 measured entries: day 0 (100), day 2 (102), day 5 (105)
    // Interpolate day 3 (between day 2 and day 5):
    //   t = (3-2)/(5-2) = 1/3, weight = 102 + (105-102)*(1/3) = 102 + 1 = 103
    // With + instead of - mutation: t = (3+2)/(5-2) = 5/3 → weight = 102 + 3*(5/3) = 107 (different!)
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-03", 102),
      makeEntry("e3", "2026-01-06", 105),
    ];
    const result = buildDailyAverages(entries, "kg");
    // Find the interpolated entry at dayIndex 3
    const day3 = result.find((d) => d.dayIndex === 3);
    expect(day3).toBeDefined();
    expect(day3!.avgWeight).toBeCloseTo(103, 5);
  });

  it("interpolated t denominator is correct when daySpan > 1 (non-zero prev.dayIndex)", () => {
    // 3 measured entries: day 0 (0), day 2 (6), day 5 (15)
    // Interpolate day 4 (between day 2 and day 5):
    //   t = (4-2)/(5-2) = 2/3, weight = 6 + (15-6)*(2/3) = 6 + 6 = 12
    // With + mutation in denominator: t = (4-2)/(5+2) = 2/7 → weight = 6 + 9*(2/7) ≈ 8.57 (different!)
    const entries = [
      makeEntry("e1", "2026-01-01", 0),
      makeEntry("e2", "2026-01-03", 6),
      makeEntry("e3", "2026-01-06", 15),
    ];
    const result = buildDailyAverages(entries, "kg");
    const day4 = result.find((d) => d.dayIndex === 4);
    expect(day4).toBeDefined();
    expect(day4!.avgWeight).toBeCloseTo(12, 5);
  });

  it("interpolated dates are in strictly ascending order", () => {
    // Verifies that the date is computed as baseTime + d * MS_PER_DAY (not minus)
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-04", 103),
    ];
    const result = buildDailyAverages(entries, "kg");
    for (let i = 1; i < result.length; i++) {
      expect((result[i].date as Date).getTime()).toBeGreaterThan((result[i - 1].date as Date).getTime());
    }
  });

  it("interpolated date for dayIndex 1 is exactly one day after baseTime", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-03", 102),
    ];
    const result = buildDailyAverages(entries, "kg");
    const day0 = result[0].date as Date;
    const day1 = result[1].date as Date;
    const MS_PER_DAY = 86400000;
    expect(day1.getTime() - day0.getTime()).toBe(MS_PER_DAY);
  });

  it("single entry produces only measured entries (no gaps to fill)", () => {
    const result = buildDailyAverages([makeEntry("e1", "2026-01-01", 80)], "kg");
    expect(result.every((d) => d.origin === "measured")).toBe(true);
  });

  it("converts kg to lbs when preferredUnit is lbs", () => {
    const result = buildDailyAverages([makeEntry("e1", "2026-01-01", 100, "kg")], "lbs");
    expect(result[0].avgWeight).toBeCloseTo(100 * 2.20462, 3);
  });

  it("converts lbs to kg when preferredUnit is kg", () => {
    const result = buildDailyAverages([makeEntry("e1", "2026-01-01", 220, "lbs")], "kg");
    expect(result[0].avgWeight).toBeCloseTo(220 * 0.453592, 3);
  });

  it("no conversion when entry unit matches preferredUnit (kg→kg)", () => {
    const result = buildDailyAverages([makeEntry("e1", "2026-01-01", 80, "kg")], "kg");
    expect(result[0].avgWeight).toBe(80);
  });

  it("no conversion when entry unit matches preferredUnit (lbs→lbs)", () => {
    const result = buildDailyAverages([makeEntry("e1", "2026-01-01", 180, "lbs")], "lbs");
    expect(result[0].avgWeight).toBe(180);
  });

  it("mixes kg and lbs entries, converting both to preferredUnit", () => {
    const entries: WeightEntry[] = [
      { id: "kg1", weightValue: 100, unit: "kg", timestamp: "2026-01-01T12:00:00.000Z" },
      { id: "lbs1", weightValue: 220.462, unit: "lbs", timestamp: "2026-01-01T14:00:00.000Z" },
    ];
    // Same day, averaged: 100 kg + (220.462 * 0.453592) kg = 100 + ~100 = ~100; avg ~100
    const result = buildDailyAverages(entries, "kg");
    expect(result[0].avgWeight).toBeCloseTo(100, 1);
  });
});

// ─── computeTrendline ─────────────────────────────────────────────────────────

describe("computeTrendline", () => {
  it("returns null for empty array", () => {
    expect(computeTrendline([])).toBeNull();
  });

  it("returns null for a single entry", () => {
    expect(computeTrendline([measured(0, 100)])).toBeNull();
  });

  it("returns null when all entries share the same dayIndex (ssXX === 0)", () => {
    // Should not normally occur but the guard must fire
    const dupes = [measured(0, 100), measured(0, 102)];
    expect(computeTrendline(dupes)).toBeNull();
  });

  it("returns a 2-element array for valid input", () => {
    const result = computeTrendline([measured(0, 100), measured(1, 102)]);
    expect(result).toHaveLength(2);
  });

  it("first point date equals first measured entry date", () => {
    const d0 = measured(0, 100);
    const d1 = measured(1, 102);
    const result = computeTrendline([d0, d1])!;
    expect(result[0].date).toBe(d0.date);
  });

  it("last point date equals last measured entry date", () => {
    const d0 = measured(0, 100);
    const d1 = measured(1, 102);
    const result = computeTrendline([d0, d1])!;
    expect(result[1].date).toBe(d1.date);
  });

  it("computes correct trendline values for upward linear data (slope=2)", () => {
    // (0,100) and (1,102): slope=2, intercept=100
    const result = computeTrendline([measured(0, 100), measured(1, 102)])!;
    expect(result[0].value).toBeCloseTo(100, 5);
    expect(result[1].value).toBeCloseTo(102, 5);
  });

  it("computes correct trendline values for downward trend", () => {
    // (0,100) and (2,98): slope = (98-99)/(2-1) = ... let me use exact math
    // n=2, xMean=1, yMean=99
    // ssXX = (0-1)^2 + (2-1)^2 = 2
    // ssXY = (0-1)*(100-99) + (2-1)*(98-99) = -1 + (-1) = -2 → slope = -1
    // intercept = 99 - (-1)*1 = 100
    // trendY(0) = 100, trendY(2) = -2+100 = 98
    const result = computeTrendline([measured(0, 100), measured(2, 98)])!;
    expect(result[0].value).toBeCloseTo(100, 5);
    expect(result[1].value).toBeCloseTo(98, 5);
  });

  it("flat data produces equal values at both endpoints", () => {
    const result = computeTrendline([measured(0, 100), measured(5, 100)])!;
    expect(result[0].value).toBeCloseTo(100, 5);
    expect(result[1].value).toBeCloseTo(100, 5);
  });

  it("three collinear points produce exact endpoints", () => {
    // (0,0), (1,1), (2,2) — perfect slope=1
    const pts = [measured(0, 0), measured(1, 1), measured(2, 2)];
    const result = computeTrendline(pts)!;
    expect(result[0].value).toBeCloseTo(0, 5);
    expect(result[1].value).toBeCloseTo(2, 5);
  });

  it("non-zero intercept is computed correctly", () => {
    // (3,10) and (5,14): slope=(14-12)/(5-4)=2? No:
    // xMean=4, yMean=12, ssXX=(3-4)^2+(5-4)^2=2, ssXY=(3-4)*(10-12)+(5-4)*(14-12)=2+2=4 → slope=2
    // intercept = 12 - 2*4 = 4
    // trendY(3) = 2*3+4 = 10, trendY(5) = 2*5+4 = 14
    const result = computeTrendline([measured(3, 10), measured(5, 14)])!;
    expect(result[0].value).toBeCloseTo(10, 5);
    expect(result[1].value).toBeCloseTo(14, 5);
  });

  it("handles null input gracefully (returns null)", () => {
    // @ts-expect-error — testing the !measured runtime guard
    expect(computeTrendline(null)).toBeNull();
  });

  it("handles undefined input gracefully (returns null)", () => {
    // @ts-expect-error — testing the !measured runtime guard
    expect(computeTrendline(undefined)).toBeNull();
  });

  it("uses n-1 (not n) as index for the last trendline point", () => {
    // With 3 points, n=3. measured[n-1] = measured[2]; measured[n] = measured[3] = undefined → TypeError
    const pts = [measured(0, 100), measured(1, 102), measured(2, 104)];
    const result = computeTrendline(pts)!;
    expect(result[1].date).toBe(pts[2].date);
    expect(result[1].value).toBeCloseTo(104, 2);
  });

  it("trendline values are distinct when slope is non-zero", () => {
    const result = computeTrendline([measured(0, 100), measured(10, 120)])!;
    expect(result[0].value).not.toBeCloseTo(result[1].value, 1);
  });
});

// ─── computeCorridorLines ─────────────────────────────────────────────────────

describe("computeCorridorLines", () => {
  // 8 measured entries: dayIndex 0-7, all avgWeight=100
  const eightDays = Array.from({ length: 8 }, (_, i) => measured(i, 100));

  it("returns null when weightGoal is null", () => {
    const settings: ChartSettings = { ...BASE_SETTINGS, weightGoal: null };
    expect(computeCorridorLines(eightDays, settings)).toBeNull();
  });

  it("returns null when maxMeasuredDayIndex < 6 (all days 0-4)", () => {
    const fiveDays = Array.from({ length: 5 }, (_, i) => measured(i, 100));
    expect(computeCorridorLines(fiveDays, BASE_SETTINGS)).toBeNull();
  });

  it("returns null when maxMeasuredDayIndex === 5 (boundary: exactly 6 days, dayIndex 0-5)", () => {
    const sixDays = Array.from({ length: 6 }, (_, i) => measured(i, 100)); // dayIndex 0–5
    expect(computeCorridorLines(sixDays, BASE_SETTINGS)).toBeNull();
  });

  it("returns non-null when maxMeasuredDayIndex === 6 (dayIndex 0-6)", () => {
    const sevenDays = Array.from({ length: 7 }, (_, i) => measured(i, 100));
    expect(computeCorridorLines(sevenDays, BASE_SETTINGS)).not.toBeNull();
  });

  it("returns an object with floor, ceiling, ideal keys", () => {
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    expect(result).toHaveProperty("floor");
    expect(result).toHaveProperty("ceiling");
    expect(result).toHaveProperty("ideal");
  });

  it("floor, ceiling, ideal each contain one point per corridor day (dayIndex >= 6)", () => {
    // eightDays: dayIndex 0-7 → corridor from dayIndex 6 → 2 corridor days
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    expect(result.floor).toHaveLength(2);
    expect(result.ceiling).toHaveLength(2);
    expect(result.ideal).toHaveLength(2);
  });

  it("ideal value equals the average of floor and ceiling at each point", () => {
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    for (let i = 0; i < result.floor.length; i++) {
      const expected = (result.floor[i].value + result.ceiling[i].value) / 2;
      expect(result.ideal[i].value).toBeCloseTo(expected, 10);
    }
  });

  it("first corridor day uses prevFloor (no lossRate step)", () => {
    // startValue=100, bufferValue=0.0075
    // prevFloor = 100 - 100*0.0075*0.5 = 100 - 0.375 = 99.625
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    expect(result.floor[0].value).toBeCloseTo(99.625, 5);
  });

  it("first corridor day uses prevCeiling (no lossRate step)", () => {
    // prevCeiling = 100 + 100*0.0075*0.5 = 100 + 0.375 = 100.375
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    expect(result.ceiling[0].value).toBeCloseTo(100.375, 5);
  });

  it("second corridor day applies lossRate to floor", () => {
    // f = prevFloor - (prevFloor - goal) * lossRate = 99.625 - (99.625-75)*0.0055
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    const expected = 99.625 - (99.625 - 75) * 0.0055;
    expect(result.floor[1].value).toBeCloseTo(expected, 4);
  });

  it("second corridor day applies lossRate*carbFatRatio to ceiling", () => {
    const adjustedGoal = 75 + 75 * 0.0075;
    const prevCeiling = 100.375;
    const expected = prevCeiling - (prevCeiling - adjustedGoal) * 0.0055 * 0.6;
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    expect(result.ceiling[1].value).toBeCloseTo(expected, 4);
  });

  it("floor is always less than or equal to ceiling", () => {
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    for (let i = 0; i < result.floor.length; i++) {
      expect(result.floor[i].value).toBeLessThanOrEqual(result.ceiling[i].value);
    }
  });

  it("calibrates startValue using the average of measurements with dayIndex 0-5", () => {
    // calibration entries (dayIndex 0-5) all have avgWeight=90
    const mixedDays = [
      ...Array.from({ length: 6 }, (_, i) => measured(i, 90)),
      measured(6, 100),
      measured(7, 100),
    ];
    // startValue=90, prevFloor = 90 - 90*0.0075*0.5 = 89.6625
    const result = computeCorridorLines(mixedDays, BASE_SETTINGS)!;
    expect(result.floor[0].value).toBeCloseTo(89.6625, 3);
  });

  it("falls back to first measured entry avgWeight when no calibration days", () => {
    // No entries with dayIndex <= 5
    const lateDays = [measured(6, 100), measured(7, 100)];
    const result = computeCorridorLines(lateDays, BASE_SETTINGS);
    expect(result).not.toBeNull();
    // startValue = measured[0].avgWeight = 100 → same prevFloor as eightDays
    expect(result!.floor[0].value).toBeCloseTo(99.625, 3);
  });

  it("includes interpolated days in corridor output when dayIndex >= 6", () => {
    const daysWithInterp = [
      ...Array.from({ length: 6 }, (_, i) => measured(i, 100)),
      interpolated(6, 100),
      measured(7, 100),
    ];
    const result = computeCorridorLines(daysWithInterp, BASE_SETTINGS)!;
    expect(result.floor).toHaveLength(2);
  });

  it("returns null when floor would be empty (no corridorDays)", () => {
    // Measured only up to dayIndex 6 but the corridor filter dayIndex>=6 gives 1 day
    // This should not be null since 1 day passes the filter
    const sevenDays = Array.from({ length: 7 }, (_, i) => measured(i, 100));
    const result = computeCorridorLines(sevenDays, BASE_SETTINGS);
    expect(result).not.toBeNull();
    expect(result!.floor).toHaveLength(1);
  });

  it("uses only 'measured' origin entries for maxMeasuredDayIndex (ignores interpolated)", () => {
    // If filter changes "measured" to "interpolated", measured array would be different
    const mixedDays = [
      ...Array.from({ length: 6 }, (_, i) => measured(i, 100)),
      interpolated(6, 100), // this should NOT count in the maxMeasuredDayIndex
      measured(7, 100),     // this should be the max measured
    ];
    const result = computeCorridorLines(mixedDays, BASE_SETTINGS);
    // maxMeasuredDayIndex = 7 (the actual measured entry) → >= 6 → non-null
    expect(result).not.toBeNull();
  });

  it("calibrates only using entries with dayIndex <= 5 (not entries with dayIndex 6+)", () => {
    // dayIndex 6 entry has avgWeight=200 (outlier) — should NOT affect calibration
    // calibration entries (0-5) all have avgWeight=90 → startValue=90
    const days = [
      ...Array.from({ length: 6 }, (_, i) => measured(i, 90)),
      measured(6, 200), // corridor day, not calibration
      measured(7, 200),
    ];
    const result = computeCorridorLines(days, BASE_SETTINGS)!;
    // startValue from calibration = 90, not influenced by day 6 avgWeight=200
    const expectedFloor0 = 90 - 90 * BASE_SETTINGS.bufferValue * 0.5;
    expect(result.floor[0].value).toBeCloseTo(expectedFloor0, 3);
  });

  it("startValue uses mean of ALL calibration entries (not just measured[0])", () => {
    // measured[0] has avgWeight=80 but others are 100 → avg=(80+100*5)/6≈96.67
    // If mutation bypasses calibration, startValue=80 (measured[0]), giving a different floor
    const days = [
      measured(0, 80),
      measured(1, 100),
      measured(2, 100),
      measured(3, 100),
      measured(4, 100),
      measured(5, 100),
      measured(6, 100),
      measured(7, 100),
    ];
    const calibAvg = (80 + 100 * 5) / 6;
    const expectedFloor0 = calibAvg - calibAvg * BASE_SETTINGS.bufferValue * 0.5;
    const result = computeCorridorLines(days, BASE_SETTINGS)!;
    expect(result.floor[0].value).toBeCloseTo(expectedFloor0, 3);
    // NOT the value from fallback measured[0]=80
    const wrongFloor = 80 - 80 * BASE_SETTINGS.bufferValue * 0.5;
    expect(result.floor[0].value).not.toBeCloseTo(wrongFloor, 3);
  });

  it("calibration INCLUDES dayIndex 5 (boundary — '<= 5' not '< 5')", () => {
    // dayIndex 5 has very different avgWeight; if excluded (<5), startValue changes
    const days = [
      measured(0, 90),
      measured(1, 90),
      measured(2, 90),
      measured(3, 90),
      measured(4, 90),
      measured(5, 60),  // outlier at boundary
      measured(6, 100),
      measured(7, 100),
    ];
    // With dayIndex 5 included (<=5): avg = (90*5+60)/6 = 85
    const avgWith5 = (90 * 5 + 60) / 6;
    const expectedFloor0 = avgWith5 - avgWith5 * BASE_SETTINGS.bufferValue * 0.5;
    const result = computeCorridorLines(days, BASE_SETTINGS)!;
    expect(result.floor[0].value).toBeCloseTo(expectedFloor0, 3);
    // NOT the value excluding dayIndex 5 (avg=90)
    const wrongFloor = 90 - 90 * BASE_SETTINGS.bufferValue * 0.5;
    expect(result.floor[0].value).not.toBeCloseTo(wrongFloor, 3);
  });

  it("calibration ignores interpolated entries (only measured entries are averaged)", () => {
    // Interpolated entries at dayIndex 1-2 have avgWeight=200 (outliers)
    // If filter is removed, calibration average includes 200s → very different startValue
    const daysWithInterp = [
      measured(0, 80),
      interpolated(1, 200),
      interpolated(2, 200),
      measured(3, 80),
      measured(4, 80),
      measured(5, 80),
      measured(6, 100),
      measured(7, 100),
    ];
    // Calibration using only measured (dayIndex 0-5): all=80, avg=80
    const expectedFloor0 = 80 - 80 * BASE_SETTINGS.bufferValue * 0.5;
    const result = computeCorridorLines(daysWithInterp, BASE_SETTINGS)!;
    expect(result.floor[0].value).toBeCloseTo(expectedFloor0, 3);
    // If interpolated were included: avg=(80+200+200+80+80+80)/6≈120 → different floor
    const wrongAvg = (80 + 200 + 200 + 80 + 80 + 80) / 6;
    const wrongFloor = wrongAvg - wrongAvg * BASE_SETTINGS.bufferValue * 0.5;
    expect(result.floor[0].value).not.toBeCloseTo(wrongFloor, 3);
  });

  it("corridor filter uses >= 6 (not > 6) for dayIndex threshold", () => {
    // dayIndex 6 must be included in corridorDays (not excluded)
    const sevenDays = Array.from({ length: 7 }, (_, i) => measured(i, 100));
    const result = computeCorridorLines(sevenDays, BASE_SETTINGS)!;
    // corridor has dayIndex 6 → floor should have 1 entry
    expect(result.floor).toHaveLength(1);
  });

  it("adjustedGoal equals weightGoal + weightGoal * bufferValue", () => {
    // Test that adjustedGoal = 75 + 75*0.0075 = 75.5625 is used for ceiling
    // ceilingStep uses adjustedGoal, not raw weightGoal
    const adjustedGoal = BASE_SETTINGS.weightGoal! + BASE_SETTINGS.weightGoal! * BASE_SETTINGS.bufferValue;
    const result = computeCorridorLines(eightDays, BASE_SETTINGS)!;
    const prevCeiling = 100.375;
    const expectedCeiling = prevCeiling - (prevCeiling - adjustedGoal) * BASE_SETTINGS.lossRate * BASE_SETTINGS.carbFatRatio;
    expect(result.ceiling[1].value).toBeCloseTo(expectedCeiling, 4);
    // Verify this differs from using raw weightGoal
    const withRawGoal = prevCeiling - (prevCeiling - BASE_SETTINGS.weightGoal!) * BASE_SETTINGS.lossRate * BASE_SETTINGS.carbFatRatio;
    expect(result.ceiling[1].value).not.toBeCloseTo(withRawGoal, 4);
  });
});

// ─── computeChartData ─────────────────────────────────────────────────────────

describe("computeChartData", () => {
  function manyEntries(n: number, startDate: string, weight = 100): WeightEntry[] {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(`${startDate}T12:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return makeEntry(`e${i}`, `${yyyy}-${mm}-${dd}`, weight);
    });
  }

  it("returns no-data corridorState for empty entries array", () => {
    const result = computeChartData([], BASE_SETTINGS, "kg");
    expect(result.corridorState).toBe("no-data");
  });

  it("returns empty dataPoints for empty entries", () => {
    const result = computeChartData([], BASE_SETTINGS, "kg");
    expect(result.dataPoints).toEqual([]);
  });

  it("returns null trendline for empty entries", () => {
    const result = computeChartData([], BASE_SETTINGS, "kg");
    expect(result.trendline).toBeNull();
  });

  it("returns null floor/ceiling/ideal for empty entries", () => {
    const result = computeChartData([], BASE_SETTINGS, "kg");
    expect(result.floor).toBeNull();
    expect(result.ceiling).toBeNull();
    expect(result.ideal).toBeNull();
  });

  it("handles null entries gracefully", () => {
    // @ts-expect-error — testing the runtime guard
    const result = computeChartData(null, BASE_SETTINGS, "kg");
    expect(result.corridorState).toBe("no-data");
  });

  it("returns no-goal corridorState when weightGoal is null", () => {
    const settings: ChartSettings = { ...BASE_SETTINGS, weightGoal: null };
    const result = computeChartData(manyEntries(10, "2026-01-01"), settings, "kg");
    expect(result.corridorState).toBe("no-goal");
  });

  it("returns null floor/ceiling/ideal when no goal is set", () => {
    const settings: ChartSettings = { ...BASE_SETTINGS, weightGoal: null };
    const result = computeChartData(manyEntries(10, "2026-01-01"), settings, "kg");
    expect(result.floor).toBeNull();
    expect(result.ceiling).toBeNull();
    expect(result.ideal).toBeNull();
  });

  it("returns calibrating corridorState when data spans < 7 days (maxMeasuredDayIndex < 6)", () => {
    // 2 entries, 5 days apart → maxMeasuredDayIndex = 4 (< 6)
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-05", 100),
    ];
    const result = computeChartData(entries, BASE_SETTINGS, "kg");
    expect(result.corridorState).toBe("calibrating");
  });

  it("returns ready corridorState and non-null corridor when data spans >= 7 days", () => {
    const result = computeChartData(manyEntries(8, "2026-01-01"), BASE_SETTINGS, "kg");
    expect(result.corridorState).toBe("ready");
    expect(result.floor).not.toBeNull();
    expect(result.ceiling).not.toBeNull();
    expect(result.ideal).not.toBeNull();
  });

  it("dataPoints contains only measured (not interpolated) entries", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-05", 110),
    ];
    const result = computeChartData(entries, BASE_SETTINGS, "kg");
    // Only 2 measured entries regardless of gap fill
    expect(result.dataPoints).toHaveLength(2);
  });

  it("dataPoints values match measured daily averages", () => {
    const entries = [
      makeEntry("e1", "2026-01-01", 100),
      makeEntry("e2", "2026-01-02", 110),
    ];
    const result = computeChartData(entries, BASE_SETTINGS, "kg");
    expect(result.dataPoints[0].value).toBe(100);
    expect(result.dataPoints[1].value).toBe(110);
  });

  it("trendline is null when there is only one measured day", () => {
    const result = computeChartData([makeEntry("e1", "2026-01-01", 100)], BASE_SETTINGS, "kg");
    expect(result.trendline).toBeNull();
  });

  it("trendline is a 2-element array when there are 2+ measured days", () => {
    const result = computeChartData(manyEntries(2, "2026-01-01"), BASE_SETTINGS, "kg");
    expect(result.trendline).toHaveLength(2);
  });

  it("applies preferredUnit conversion to dataPoints (lbs entry with kg preferredUnit)", () => {
    const entries = [makeEntry("e1", "2026-01-01", 220, "lbs")];
    const result = computeChartData(entries, BASE_SETTINGS, "kg");
    expect(result.dataPoints[0].value).toBeCloseTo(220 * 0.453592, 3);
  });

  it("applies preferredUnit conversion to dataPoints (kg entry with lbs preferredUnit)", () => {
    const entries = [makeEntry("e1", "2026-01-01", 100, "kg")];
    const result = computeChartData(entries, BASE_SETTINGS, "lbs");
    expect(result.dataPoints[0].value).toBeCloseTo(100 * 2.20462, 3);
  });

  it("no-goal state does not prevent dataPoints or trendline from being populated", () => {
    const settings: ChartSettings = { ...BASE_SETTINGS, weightGoal: null };
    const result = computeChartData(manyEntries(3, "2026-01-01"), settings, "kg");
    expect(result.dataPoints).toHaveLength(3);
    expect(result.trendline).toHaveLength(2);
  });

  it("exactly 7 measured days (dayIndex 0-6) returns calibrating state", () => {
    // maxMeasuredDayIndex = 6 → meets the ">= 6" threshold → corridor should compute
    const result = computeChartData(manyEntries(7, "2026-01-01"), BASE_SETTINGS, "kg");
    expect(result.corridorState).toBe("ready");
  });

  it("exactly 6 measured days (dayIndex 0-5, maxMeasuredDayIndex=5) is still calibrating", () => {
    const result = computeChartData(manyEntries(6, "2026-01-01"), BASE_SETTINGS, "kg");
    expect(result.corridorState).toBe("calibrating");
  });
});
