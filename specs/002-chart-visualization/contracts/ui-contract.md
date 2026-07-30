# Contract: UI Components — Chart Visualization

**Feature**: 002-chart-visualization
**Created**: 2026-03-13
**Contract version**: 1.0.0

---

## Chart Section (`#chart-section`)

### Visibility

- Hidden (`hidden` attribute) when `ChartDataSet.corridorState === "no-data"` (zero entries)
- Visible as soon as the first entry exists

### DOM Structure

```html
<section id="chart-section" hidden>
  <div id="chart-container">
    <!-- chart canvas or SVG rendered here -->
  </div>
  <div id="chart-info-msg" role="status" aria-live="polite">
    <!-- shown when corridorState is "no-goal" or "calibrating" -->
  </div>
  <button id="chart-settings-btn" type="button" aria-label="Configure chart settings">
    Settings
  </button>
</section>
```

**Placement**: `#chart-section` is the first child of `<main>`, above the entry form.

### Informational Message (`#chart-info-msg`)

| `corridorState` | Message content | Visibility |
|-----------------|-----------------|------------|
| `"ready"` | — | Hidden |
| `"no-goal"` | "Corridor lines require 7 days of data and a configured weight goal." | Visible |
| `"calibrating"` | "Corridor lines require 7 days of data and a configured weight goal." | Visible |
| `"no-data"` | — | Entire section hidden |

---

## Settings Modal (`#chart-settings-modal`)

### Trigger

- Opened by clicking `#chart-settings-btn`
- Closed by: Save button (persists + closes), Cancel button (discards + closes), Escape key (discards + closes), click outside modal

### DOM Structure

```html
<dialog id="chart-settings-modal" aria-labelledby="settings-modal-title">
  <h2 id="settings-modal-title">Chart Settings</h2>
  <form id="chart-settings-form" method="dialog">
    <label for="weight-goal-input">Weight goal</label>
    <input id="weight-goal-input" type="number" step="any" aria-describedby="weight-goal-error" />
    <span id="weight-goal-error" role="alert"></span>

    <label for="loss-rate-input">Loss rate</label>
    <input id="loss-rate-input" type="number" step="any" aria-describedby="loss-rate-error" />
    <span id="loss-rate-error" role="alert"></span>

    <label for="carb-fat-ratio-input">Carb/fat ratio</label>
    <input id="carb-fat-ratio-input" type="number" step="any" aria-describedby="carb-fat-error" />
    <span id="carb-fat-error" role="alert"></span>

    <label for="buffer-value-input">Buffer value</label>
    <input id="buffer-value-input" type="number" step="any" aria-describedby="buffer-error" />
    <span id="buffer-error" role="alert"></span>

    <button id="settings-save-btn" type="submit">Save</button>
    <button id="settings-cancel-btn" type="button">Cancel</button>
  </form>
</dialog>
```

### Validation behaviour

- Validation fires on Save attempt only (not on blur)
- Each invalid field shows its specific inline error (`role="alert"`)
- No values are persisted until ALL fields pass validation
- On successful save: modal closes, chart re-renders immediately with new settings

### Pre-population

On modal open, inputs are pre-populated with current persisted values (or defaults
if never saved): `lossRate=0.0055`, `carbFatRatio=0.6`, `bufferValue=0.0075`,
`weightGoal=""` (empty until user sets one).

### Keyboard accessibility

- Focus moves to first input when modal opens
- Tab cycles through inputs and buttons within modal
- Escape closes modal (discards changes)
- Enter in a field does NOT submit (prevents accidental save); Save button must be clicked/activated explicitly

---

## Chart Rendering Contract

The chart rendering component (`src/ts/chart.ts`) accepts only a `ChartDataSet`
and renders it. It MUST NOT:
- Import `chart-calculations.ts` for computation
- Access `localStorage` directly
- Re-derive daily averages or corridor values

### Series rendering

| Series | Colour (suggested) | Rendered when |
|--------|--------------------|---------------|
| Data points | Primary (e.g. blue dots) | Always when `dataPoints.length > 0` |
| Trendline | Neutral (e.g. grey dashed line) | `trendline !== null` |
| Floor | Green | `floor !== null` |
| Ceiling | Red | `ceiling !== null` |
| Ideal | Purple | `ideal !== null` |

Exact colours are a UI implementation detail; the contract only requires the five
series are visually distinguishable from each other.

### X-axis

- Labels: calendar dates in the user's local format, e.g. "13 Mar" or "13 Mar 2026"
- Date tick density MUST adapt to viewport width (fewer ticks on narrow screens)
- Day-index numbers ("Day 1", "Day 7") MUST NOT appear as labels

### Y-axis

- Unit label shows the current preferred unit (kg or lbs)
- Scale adapts to the min/max values across all rendered series

### Responsiveness

- Chart MUST fill the width of `#chart-container` at all viewport widths 320px–1280px
- No horizontal scrolling within the chart
- Chart height: minimum 200px; scales proportionally on wider screens

---

## Settings Storage Contract

Key: `weight_tracker_chart_settings`
Format: JSON string

```json
{
  "weightGoal": 75.0,
  "lossRate": 0.0055,
  "carbFatRatio": 0.6,
  "bufferValue": 0.0075
}
```

`weightGoal` may be `null` (JSON `null`) when not set. All other fields always
present with numeric values > 0.
