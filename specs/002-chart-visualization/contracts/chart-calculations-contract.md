# Contract: chart-calculations.ts

**Feature**: 002-chart-visualization
**Module**: `src/ts/chart-calculations.ts`
**Created**: 2026-03-13
**Contract version**: 1.0.0

---

## Purpose

Pure-function calculation module. Takes raw entries and chart settings as input;
returns a fully pre-computed `ChartDataSet` ready for the rendering layer. Contains
ALL domain logic. The rendering component MUST NOT import any other module for
domain calculations.

This module is intentionally isolated so that in a future iteration, the function
signatures remain the same but the implementations can be replaced by calls to a
backend API — with zero changes to the chart rendering component.

---

## Exported Functions

### `computeChartData`

```typescript
function computeChartData(
  entries: WeightEntry[],
  settings: ChartSettings,
  preferredUnit: WeightUnit
): ChartDataSet
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `entries` | `WeightEntry[]` | All stored weight entries (unsorted, mixed units allowed) |
| `settings` | `ChartSettings` | User-configured chart parameters from localStorage |
| `preferredUnit` | `WeightUnit` | Current preferred unit — all values converted to this before calculation |

**Returns**: `ChartDataSet` — see data-model.md for full type definition.

**Guarantees**:
- Pure function: same inputs always produce same output; no side effects
- No DOM access; no localStorage access; no network calls
- All entries are unit-converted to `preferredUnit` before any aggregation
- `dataPoints` contains only measured-origin daily averages
- `trendline` is `null` when fewer than 2 distinct measured calendar days exist, or when all entries are on the same day
- `floor`, `ceiling`, `ideal` are all `null` together when `corridorState !== "ready"`
- When `corridorState === "ready"`, `floor[n] ≤ ideal[n] ≤ ceiling[n]` for all `n`
- Interpolated `DailyAverage` entries are used for corridor calculations only — never appear in `dataPoints` or `trendline`
- `ChartPoint.date` values are local-timezone calendar days (midnight)

**Error behaviour**: Never throws. Returns `ChartDataSet` with `corridorState: "no-data"` and all arrays empty when `entries` is empty or null.

---

### `buildDailyAverages`

```typescript
function buildDailyAverages(
  entries: WeightEntry[],
  preferredUnit: WeightUnit
): DailyAverage[]
```

Internal helper exposed for unit testing. Converts raw entries to per-calendar-day
averages (measured), then fills gaps with linear interpolation (interpolated). Returns
sorted ascending by `dayIndex`. Never throws.

---

### `computeTrendline`

```typescript
function computeTrendline(
  measured: DailyAverage[]
): ChartPoint[] | null
```

Internal helper exposed for unit testing. Accepts only `origin === "measured"` daily
averages. Returns `null` when fewer than 2 distinct day indices, or when
`Σ((xi - x̄)²) === 0`.

---

### `computeCorridorLines`

```typescript
function computeCorridorLines(
  dailyAverages: DailyAverage[],
  settings: ChartSettings
): { floor: ChartPoint[]; ceiling: ChartPoint[]; ideal: ChartPoint[] } | null
```

Internal helper exposed for unit testing. Returns `null` when `settings.weightGoal`
is null or when measured daily averages span fewer than 7 calendar days. Uses full
`dailyAverages` array (including interpolated) for iterative calculation.

---

## Types (defined in `src/ts/chart-calculations.ts` or `src/ts/model.ts`)

```typescript
type CorridorState = "ready" | "no-goal" | "calibrating" | "no-data";

interface ChartPoint {
  date: Date;
  value: number;
}

interface ChartDataSet {
  dataPoints: ChartPoint[];
  trendline: ChartPoint[] | null;
  floor: ChartPoint[] | null;
  ceiling: ChartPoint[] | null;
  ideal: ChartPoint[] | null;
  corridorState: CorridorState;
}

interface ChartSettings {
  weightGoal: number | null;
  lossRate: number;          // default 0.0055
  carbFatRatio: number;      // default 0.6
  bufferValue: number;       // default 0.0075
}

interface DailyAverage {
  date: Date;
  dayIndex: number;
  avgWeight: number;
  origin: "measured" | "interpolated";
}
```

---

## Boundary Conditions

| Condition | Behaviour |
|-----------|-----------|
| `entries = []` | Returns `{ dataPoints: [], trendline: null, floor: null, ceiling: null, ideal: null, corridorState: "no-data" }` |
| 1 entry | `dataPoints` has 1 point; `trendline: null`; corridor depends on days |
| All entries same day | `trendline: null` (division-by-zero guard) |
| `weightGoal = null` | `corridorState: "no-goal"`, corridor lines all null |
| < 7 measured days, goal set | `corridorState: "calibrating"`, corridor lines all null |
| No measured entries in days 0–5 | Fall back to earliest measured day's value as `startValue` |
| `lossRate / carbFatRatio / bufferValue = 0` | Caller must validate; these values are rejected at the settings layer before reaching this function |
