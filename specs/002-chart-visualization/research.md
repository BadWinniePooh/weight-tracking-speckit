# Research: Weight Chart Visualization

**Feature**: 002-chart-visualization
**Created**: 2026-03-13

---

## Decision 1: Charting Library

**Decision**: Chart.js 4.x with selective component imports + `chartjs-adapter-date-fns`

**Rationale**: Chart.js is the correct tradeoff for this use case. Multi-series line
charts with a trendline and static reference lines (floor/ceiling/ideal) are its
exact core use case. With selective imports (`LineController`, `LineElement`,
`PointElement`, `LinearScale`, `TimeScale`, `Tooltip`, `Legend`, `Filler` — no
`chart.js/auto`), the bundle lands at ~40–48 KB gzip. The date adapter
(`chartjs-adapter-date-fns` + `date-fns`) adds ~5 KB and eliminates all custom date
formatting/tick logic. TypeScript types ship with the package (no `@types/*`
dependency). `responsive: true` + `maintainAspectRatio: false` on a fixed-height
container handles mobile resize without manual `ResizeObserver` wiring.

**Alternatives considered**:

| Option | Bundle | Decision |
|--------|--------|----------|
| uPlot | ~15 KB gzip | Rejected — manual resize wiring, manual tooltip, sparse docs, DefinitelyTyped types lag releases. 30 KB saving not worth the integration cost. |
| Lightweight Charts (TradingView) | ~45 KB gzip | Rejected — financial-chart visual paradigm requires heavy CSS override; diagonal trendline must be a full series; no built-in legend. |
| Plain Canvas API | 0 KB | Rejected — 300–500 lines of rendering code to maintain; ongoing cost as chart evolves (zoom, annotations). |
| SVG custom rendering | 0 KB | Rejected — similar effort to Canvas; native scaling is an advantage, but tooltip hit detection and axis label density still require manual work. |

**Implementation notes**:
- Import: `import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Filler } from 'chart.js'`
- `Chart.register(...)` with only those components
- Reference lines (floor/ceiling/ideal): additional datasets with `pointRadius: 0`, `borderWidth: 1`, `borderDash: [4, 4]`, `tension: 0`
- Trendline: two-point dataset `[{x: firstDate, y: trendY(0)}, {x: lastDate, y: trendY(n)}]` — computed in `chart-calculations.ts`
- Date adapter: `npm install chartjs-adapter-date-fns date-fns`; x-axis: `type: 'time'`, `time.unit: 'day'`, `time.displayFormats.day: 'd MMM'`
- Disable animation on mobile or unconditionally (`animation: false`) for snappiness
- Container `<div>` with fixed `height: 260px` (mobile) / `height: 320px` (desktop) + `width: 100%`; canvas fills it

---

## Decision 2: Calculation Architecture

**Decision**: Dedicated pure-function module `src/ts/chart-calculations.ts`

**Rationale**: Mandated by spec FR-011 and the Constraints section. All domain logic
(regression, daily averages, gap interpolation, floor/ceiling/ideal iteration) lives
in this module. The chart rendering component (`src/ts/chart.ts`) imports only
`ChartDataSet` from this module — no raw `WeightEntry[]` is passed to the renderer.
This matches the spec's future-migration requirement: swapping the module for an API
call requires no changes to `chart.ts`.

**Interface**: `computeChartData(entries, settings, preferredUnit) → ChartDataSet`

Internal helpers exported for unit testing:
- `buildDailyAverages(entries, preferredUnit) → DailyAverage[]`
- `computeTrendline(measured: DailyAverage[]) → ChartPoint[] | null`
- `computeCorridorLines(dailyAverages, settings) → {...} | null`

---

## Decision 3: Unit Conversion

**Decision**: Convert all entry weights to `preferredUnit` inside `buildDailyAverages`
before any aggregation or calculation.

**Rationale**: Entries store their own unit (`"kg"` or `"lbs"`). Converting at the
aggregation boundary ensures the trendline regression and corridor formulas always
operate on homogeneous values. The renderer never sees raw mixed-unit data.

**Conversion factors**:
- kg → lbs: multiply by `2.20462`
- lbs → kg: multiply by `0.453592`

---

## Decision 4: Gap Interpolation Approach

**Decision**: Linear interpolation between nearest boundary measured days.

**Rationale**: Simple, predictable, sufficient for the use case. A user's weight
between measured days is reasonably approximated by a straight line between their
nearest weigh-ins. More sophisticated approaches (spline, last-value-carried-forward)
add complexity without meaningful accuracy improvement for daily weight data.

**Implementation**: After building `measured[]` DailyAverages, iterate day indices
0..maxDayIndex. For each missing day index `d` between two measured indices `prev`
and `next`:
```
t = (d - prev.dayIndex) / (next.dayIndex - prev.dayIndex)
interpolated.avgWeight = prev.avgWeight + (next.avgWeight - prev.avgWeight) * t
```
Days before the first measured entry and after the last measured entry are NOT
extrapolated — interpolation only fills interior gaps.

---

## Decision 5: Settings Modal Implementation

**Decision**: Use the native HTML `<dialog>` element.

**Rationale**: Native `<dialog>` provides built-in focus trapping, Escape-to-close,
and the `::backdrop` pseudo-element for dimming. It is well-supported in all modern
browsers (Chromium 37+, Firefox 98+, Safari 15.4+). Zero extra JavaScript for
accessibility scaffolding — `showModal()` / `close()` are the full API. Consistent
with the project's zero-runtime-dependency philosophy for UI components.

**Polyfill**: Not needed; target browsers all support `<dialog>` natively.

---

## Decision 6: Chart Settings Storage Key

**Decision**: `weight_tracker_chart_settings`

**Rationale**: Consistent with existing `weight_tracker_` prefix convention used by
`weight_tracker_entries` and `weight_tracker_preferences`.

---

## New Dependencies Required

| Package | Version | Purpose | Bundle impact (gzip) |
|---------|---------|---------|----------------------|
| `chart.js` | `^4.0.0` | Chart rendering | ~40 KB |
| `chartjs-adapter-date-fns` | `^3.0.0` | Date-axis formatting | ~3 KB |
| `date-fns` | `^3.0.0` | Date formatting utilities | ~5 KB (tree-shaken) |

**Constitution V (YAGNI) justification**: No built-in browser API provides a
complete multi-series responsive line chart with date axis. A custom Canvas/SVG
implementation would require 300–500 lines of rendering code, increasing maintenance
burden more than a well-maintained library. The total added bundle (~48 KB gzip) is
proportionate for a personal health app where the user is the sole consumer.
