import type {
  WeightEntry,
  WeightUnit,
  ChartSettings,
  ChartDataSet,
  ChartPoint,
  DailyAverage,
  CorridorState,
} from "./model";

// ─── Unit conversion ──────────────────────────────────────────────────────────

function toUnit(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === "kg" && toUnit === "lbs") return value * 2.20462;
  return value * 0.453592; // lbs → kg
}

// ─── Calendar day key (local timezone) ───────────────────────────────────────

function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function calendarDayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── buildDailyAverages ───────────────────────────────────────────────────────

export function buildDailyAverages(
  entries: WeightEntry[],
  preferredUnit: WeightUnit
): DailyAverage[] {
  if (!entries || entries.length === 0) return [];

  // Group entries by calendar day
  const byDay = new Map<string, { date: Date; total: number; count: number }>();
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const key = calendarDayKey(d);
    const converted = toUnit(entry.weightValue, entry.unit, preferredUnit);
    if (byDay.has(key)) {
      const existing = byDay.get(key)!;
      existing.total += converted;
      existing.count += 1;
    } else {
      byDay.set(key, { date: calendarDayStart(d), total: converted, count: 1 });
    }
  }

  // Sort by date ascending and assign dayIndex
  const sorted = Array.from(byDay.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  if (sorted.length === 0) return [];

  const baseTime = sorted[0].date.getTime();
  const MS_PER_DAY = 86400000;

  const measured: DailyAverage[] = sorted.map((day) => ({
    date: day.date,
    dayIndex: Math.round((day.date.getTime() - baseTime) / MS_PER_DAY),
    avgWeight: day.total / day.count,
    origin: "measured" as const,
  }));

  // Gap interpolation — fill interior missing days
  if (measured.length < 2) return measured;

  const maxDayIndex = measured[measured.length - 1].dayIndex;
  const result: DailyAverage[] = [];
  let mi = 0;

  for (let d = 0; d <= maxDayIndex; d++) {
    if (measured[mi].dayIndex === d) {
      result.push(measured[mi]);
      mi++;
    } else {
      // Find surrounding measured entries
      const prev = measured[mi - 1];
      const next = measured[mi];
      const t = (d - prev.dayIndex) / (next.dayIndex - prev.dayIndex);
      const interpolatedWeight = prev.avgWeight + (next.avgWeight - prev.avgWeight) * t;
      const interpolatedDate = new Date(baseTime + d * MS_PER_DAY);
      result.push({
        date: interpolatedDate,
        dayIndex: d,
        avgWeight: interpolatedWeight,
        origin: "interpolated",
      });
    }
  }

  return result;
}

// ─── computeTrendline ─────────────────────────────────────────────────────────

export function computeTrendline(measured: DailyAverage[]): ChartPoint[] | null {
  if (!measured || measured.length < 2) return null;

  const n = measured.length;
  const xMean = measured.reduce((s, d) => s + d.dayIndex, 0) / n;
  const yMean = measured.reduce((s, d) => s + d.avgWeight, 0) / n;

  const ssXX = measured.reduce((s, d) => s + (d.dayIndex - xMean) ** 2, 0);
  if (ssXX === 0) return null; // all same day

  const ssXY = measured.reduce((s, d) => s + (d.dayIndex - xMean) * (d.avgWeight - yMean), 0);
  const slope = ssXY / ssXX;
  const intercept = yMean - slope * xMean;

  const trendY = (xi: number) => slope * xi + intercept;

  return [
    { date: measured[0].date, value: trendY(measured[0].dayIndex) },
    { date: measured[n - 1].date, value: trendY(measured[n - 1].dayIndex) },
  ];
}

// ─── computeCorridorLines ─────────────────────────────────────────────────────

export function computeCorridorLines(
  dailyAverages: DailyAverage[],
  settings: ChartSettings
): { floor: ChartPoint[]; ceiling: ChartPoint[]; ideal: ChartPoint[] } | null {
  if (!settings.weightGoal) return null;

  const measured = dailyAverages.filter((d) => d.origin === "measured");
  const maxMeasuredDayIndex = measured.length > 0 ? measured[measured.length - 1].dayIndex : 0;
  if (maxMeasuredDayIndex < 6) return null; // need at least dayIndex 6 (day 7)

  const { weightGoal, lossRate, carbFatRatio, bufferValue } = settings;

  // Calibration: average of measured entries in dayIndex 0–5
  const calibrationEntries = measured.filter((d) => d.dayIndex <= 5);
  let startValue: number;
  if (calibrationEntries.length > 0) {
    startValue = calibrationEntries.reduce((s, d) => s + d.avgWeight, 0) / calibrationEntries.length;
  } else {
    // Fallback: earliest measured entry
    startValue = measured[0].avgWeight;
  }

  const adjustedGoal = weightGoal + weightGoal * bufferValue;

  const floor: ChartPoint[] = [];
  const ceiling: ChartPoint[] = [];
  const ideal: ChartPoint[] = [];

  // Only produce corridor from dayIndex 6 onward
  const corridorDays = dailyAverages.filter((d) => d.dayIndex >= 6);
  let prevFloor = startValue - startValue * bufferValue * 0.5;
  let prevCeiling = startValue + startValue * bufferValue * 0.5;
  let firstDay = true;

  for (const day of corridorDays) {
    let f: number;
    let c: number;
    if (firstDay) {
      f = prevFloor;
      c = prevCeiling;
      firstDay = false;
    } else {
      f = prevFloor - (prevFloor - weightGoal) * lossRate;
      c = prevCeiling - (prevCeiling - adjustedGoal) * lossRate * carbFatRatio;
    }
    floor.push({ date: day.date, value: f });
    ceiling.push({ date: day.date, value: c });
    ideal.push({ date: day.date, value: (f + c) / 2 });
    prevFloor = f;
    prevCeiling = c;
  }

  if (floor.length === 0) return null;
  return { floor, ceiling, ideal };
}

// ─── computeChartData ─────────────────────────────────────────────────────────

export function computeChartData(
  entries: WeightEntry[],
  settings: ChartSettings,
  preferredUnit: WeightUnit
): ChartDataSet {
  const empty: ChartDataSet = {
    dataPoints: [],
    trendline: null,
    floor: null,
    ceiling: null,
    ideal: null,
    corridorState: "no-data",
  };

  if (!entries || entries.length === 0) return empty;

  const allDailyAverages = buildDailyAverages(entries, preferredUnit);
  const measured = allDailyAverages.filter((d) => d.origin === "measured");

  const dataPoints: ChartPoint[] = measured.map((d) => ({ date: d.date, value: d.avgWeight }));
  const trendline = computeTrendline(measured);

  // Determine corridor state
  const maxMeasuredDayIndex = measured.length > 0 ? measured[measured.length - 1].dayIndex : 0;
  let corridorState: CorridorState;
  let floor: ChartPoint[] | null = null;
  let ceiling: ChartPoint[] | null = null;
  let ideal: ChartPoint[] | null = null;

  if (!settings.weightGoal) {
    corridorState = "no-goal";
  } else if (maxMeasuredDayIndex < 6) {
    corridorState = "calibrating";
  } else {
    const corridor = computeCorridorLines(allDailyAverages, settings);
    if (corridor) {
      corridorState = "ready";
      floor = corridor.floor;
      ceiling = corridor.ceiling;
      ideal = corridor.ideal;
    } else {
      corridorState = "calibrating";
    }
  }

  return { dataPoints, trendline, floor, ceiling, ideal, corridorState };
}
