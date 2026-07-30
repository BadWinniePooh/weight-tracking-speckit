# Data Model: Weight Chart Visualization

**Feature**: 002-chart-visualization
**Created**: 2026-03-13
**Source**: spec.md FR-001–FR-021, Key Entities, Clarifications

---

## Entities

### ChartSettings

Persisted to `localStorage` under key `weight_tracker_chart_settings`.

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `weightGoal` | `number \| null` | No | `null` | Positive number or null; null means corridor lines are hidden |
| `lossRate` | `number` | Yes | `0.0055` | > 0 |
| `carbFatRatio` | `number` | Yes | `0.6` | > 0 |
| `bufferValue` | `number` | Yes | `0.0075` | > 0 |

**Notes**:
- `weightGoal` is stored in the user's currently selected preferred unit. If the user changes their preferred unit, the stored numeric value is retained as-is (no conversion applied).
- Saving invalid values MUST be rejected; the persisted state must never contain invalid data.

---

### DailyAverage

An intermediate, computed-only value — never stored. Produced by aggregating `WeightEntry[]` before chart calculations run.

| Field | Type | Notes |
|-------|------|-------|
| `date` | `Date` (calendar day, local timezone) | Midnight of the calendar day |
| `dayIndex` | `number` | Integer days since the first entry's calendar day (0-based) |
| `avgWeight` | `number` | Average weight of all entries on this day, in current preferred unit |
| `origin` | `"measured" \| "interpolated"` | `"measured"` = from actual entries; `"interpolated"` = gap-filled via linear interpolation |

**Gap-filling rule**: When calendar days between two measured days have no entries, linear interpolation is applied:
```
interpolated(d) = avgWeight(prev) + (avgWeight(next) - avgWeight(prev)) × (d - dayIndex(prev)) / (dayIndex(next) - dayIndex(prev))
```
Interpolated `DailyAverage` entries are used only as inputs to corridor line calculations. They are never rendered as chart data points, and never included in trendline regression.

**Calibration window (days 1–6)**: Day index 0 is the first entry's calendar day. Days 0–5 (i.e., the first 6 days) form the calibration window. `startValue` for corridor calculations is the average `avgWeight` of all `measured` `DailyAverage` entries in this window. If no `measured` entries exist in days 0–5, fall back to the `avgWeight` of the earliest `measured` `DailyAverage` in the entire dataset.

---

### ChartDataSet

The output of `chart-calculations.ts` — consumed exclusively by the chart rendering component. The rendering component receives only this structure and contains no domain logic.

| Field | Type | Notes |
|-------|------|-------|
| `dataPoints` | `ChartPoint[]` | One per measured `DailyAverage` (origin = `"measured"`) |
| `trendline` | `ChartPoint[] \| null` | `null` when < 2 measured days or all entries on one day |
| `floor` | `ChartPoint[] \| null` | `null` when corridor not renderable (see conditions below) |
| `ceiling` | `ChartPoint[] \| null` | `null` when corridor not renderable |
| `ideal` | `ChartPoint[] \| null` | `null` when corridor not renderable |
| `corridorState` | `CorridorState` | Why corridor lines are or aren't shown |

**`ChartPoint`**:

| Field | Type | Notes |
|-------|------|-------|
| `date` | `Date` | Calendar date for this point (used as x-axis label) |
| `value` | `number` | Weight value in current preferred unit |

**`CorridorState`**:

```
"ready"           — weightGoal set, ≥ 7 days of data; all corridor lines rendered
"no-goal"         — weightGoal is null; show informational message
"calibrating"     — weightGoal set but dataset spans < 7 days; show informational message
"no-data"         — no entries at all; chart section hidden entirely
```

**Corridor renderable conditions** (all must be true):
1. `ChartSettings.weightGoal` is not null
2. Dataset spans at least 7 calendar days (day index ≥ 6 exists in measured data)

When corridor lines are null, `floor`, `ceiling`, and `ideal` arrays are all null together.

---

## Calculation Formulas

All implemented in `src/ts/chart-calculations.ts` as pure functions.

### Trendline (linear regression)

Inputs: measured `DailyAverage[]` (origin = `"measured"` only)

```
x̄ = mean of dayIndex values
ȳ = mean of avgWeight values
slope     = Σ((xi - x̄)(yi - ȳ)) / Σ((xi - x̄)²)
intercept = ȳ - slope × x̄
trendY(i) = slope × dayIndex(i) + intercept
```

Guard: if `Σ((xi - x̄)²) = 0` (all entries on one day), return `null` (no trendline).

### Floor line

```
startValue = calibration average (see DailyAverage calibration window above)
floor[6]   = startValue - (startValue × bufferValue × 0.5)           // day index 6 (day 7)
floor[n]   = floor[n-1] - (floor[n-1] - weightGoal) × lossRate       // n > 6
```

### Ceiling line

```
startValue    = calibration average (same as floor)
adjustedGoal  = weightGoal + (weightGoal × bufferValue)
ceiling[6]    = startValue + (startValue × bufferValue × 0.5)
ceiling[n]    = ceiling[n-1] - (ceiling[n-1] - adjustedGoal) × lossRate × carbFatRatio
```

### Ideal line

```
ideal[n] = (floor[n] + ceiling[n]) / 2
```

---

## localStorage Keys

| Key | Stores | Notes |
|-----|--------|-------|
| `weight_tracker_chart_settings` | `ChartSettings` JSON | New key added by this feature |
| `weight_tracker_entries` | `WeightEntry[]` | Existing — read-only from this feature |
| `weight_tracker_preferences` | `UserPreferences` | Existing — unit preference read to convert values |

---

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `weightGoal` | Positive number or null | "Weight goal must be a positive number." |
| `lossRate` | > 0 | "Loss rate must be greater than zero." |
| `carbFatRatio` | > 0 | "Carb/fat ratio must be greater than zero." |
| `bufferValue` | > 0 | "Buffer value must be greater than zero." |
| Any field | Non-numeric input | "Please enter a valid number." |

---

## State Transitions

```
No entries → chart hidden
     ↓ (first entry logged)
≥1 entry, no goal → chart visible; trendline if ≥2 measured days; "no-goal" message
     ↓ (weightGoal set)
≥1 entry, goal set, <7 days → trendline if ≥2 days; "calibrating" message
     ↓ (7th distinct calendar day logged)
≥7 days, goal set → all lines rendered; no message
     ↓ (weightGoal cleared)
back to "no-goal" state
```
