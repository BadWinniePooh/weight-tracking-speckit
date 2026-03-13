# Implementation Plan: Weight Chart Visualization

**Branch**: `002-chart-visualization` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-chart-visualization/spec.md`

## Summary

Add a chart visualization to the weight tracking app that renders the user's logged weight entries over time as a line chart with four calculated series: data points (measured daily averages), a linear-regression trendline, and three corridor lines (floor, ceiling, ideal) that converge toward the user's weight goal.

All domain calculations are encapsulated in a pure-function module (`src/ts/chart-calculations.ts`) that accepts raw entries + settings and returns a pre-computed `ChartDataSet`. The rendering component (`src/ts/chart.ts`) imports only that output — no domain logic in the renderer. Rendering is handled by Chart.js 4.x with selective imports and `chartjs-adapter-date-fns` for calendar-date x-axis formatting. Chart settings are persisted to `localStorage` under `weight_tracker_chart_settings` and edited via a native `<dialog>` settings modal.

## Technical Context

**Language/Version**: TypeScript 5.x (browser target: ES2020)
**Primary Dependencies**: Chart.js ^4.0.0, chartjs-adapter-date-fns ^3.0.0, date-fns ^3.0.0 (new); Vite 5.x (existing)
**Storage**: Browser `localStorage` (keys: `weight_tracker_chart_settings`, `weight_tracker_entries`, `weight_tracker_preferences`)
**Testing**: Vitest 2.x + jsdom
**Target Platform**: Browser (Chromium, Firefox 98+, Safari 15.4+); responsive 320 px–1280 px
**Project Type**: Single-page web application (frontend-only)
**Performance Goals**: Chart renders within one animation frame on entry add/delete; `animation: false` on chart for snappiness
**Constraints**: No backend; all data in localStorage; offline-capable; bundle increase ≤ 50 KB gzip
**Scale/Scope**: Single user, personal health data; localStorage sufficient for hundreds of entries

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | `spec.md` complete with 3 user stories (US1–US3), 21 FRs, acceptance scenarios, and measurable success criteria. Clarifications session recorded. |
| II. Privacy & Data Ownership | ✅ PASS | All data remains in localStorage; no third-party analytics; no new network calls. Chart settings stored locally. `weightGoal` is sensitive health data — handled identically to existing entries (localStorage, plaintext per v1 constitution policy). |
| III. Test-First | ✅ PASS | Pure-function module `chart-calculations.ts` is fully unit-testable. Tests for `buildDailyAverages`, `computeTrendline`, `computeCorridorLines`, and `computeChartData` must be written before implementation (TDD sequence enforced in tasks.md). |
| IV. Incremental Delivery | ✅ PASS | US1 (trendline chart, P1) is a usable MVP independent of US2/US3. Corridor lines (US3, P2) require US2 settings to be wired first but both are gated on US1 delivery. |
| V. Simplicity (YAGNI) | ⚠️ DEVIATION JUSTIFIED | Three new runtime dependencies added (Chart.js, date-fns adapter, date-fns). Justified in Complexity Tracking below. No unnecessary abstractions; rendering delegate pattern is required by FR-011 for future API migration. |

**Post-design re-check**: ✅ Contracts and data model confirm no domain logic leaks into renderer; no over-engineering detected; interpolated DailyAverages reuse existing array iteration pattern.

## Project Structure

### Documentation (this feature)

```text
specs/002-chart-visualization/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   ├── chart-calculations-contract.md   # Phase 1 output
│   └── ui-contract.md                   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── ts/
│   ├── chart-calculations.ts   # NEW — pure-function calculation module
│   ├── chart.ts                # NEW — Chart.js rendering component
│   ├── main.ts                 # MODIFIED — wire chart section, settings modal events
│   ├── model.ts                # MODIFIED — add ChartSettings, ChartDataSet, CorridorState types
│   ├── storage.ts              # MODIFIED — add loadChartSettings / saveChartSettings
│   ├── ui.ts                   # MODIFIED — add renderChart, showChartSection helpers
│   ├── export.ts               # UNCHANGED
│   └── preferences.ts          # UNCHANGED
├── css/
│   └── main.css                # MODIFIED — chart container, settings modal styles
└── index.html                  # MODIFIED — add #chart-section, <dialog> modal

tests/
├── chart-calculations.test.ts  # NEW — unit tests for pure calculation module
├── chart.test.ts               # NEW — rendering smoke tests (chart mounts, series present)
├── model.test.ts               # UNCHANGED
├── storage.test.ts             # MODIFIED — add ChartSettings load/save tests
├── ui.test.ts                  # MODIFIED — add chart section visibility tests
└── export.test.ts              # UNCHANGED
```

**Structure Decision**: Single-project layout (no backend/frontend split). All new source files are additions within the existing `src/ts/` tree. The calculation module is a peer of `model.ts` and `storage.ts`, not a subdirectory, consistent with the existing flat module structure.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Runtime dependency: `chart.js ^4.0.0` | Multi-series responsive line chart with date axis, trendline, and reference lines is the core feature requirement. | Custom Canvas/SVG: 300–500 lines of rendering code with no upstream maintenance. uPlot: manual ResizeObserver, manual tooltip, sparse docs. Lightweight Charts: financial paradigm, heavy CSS override needed, no legend. See research.md Decision 1. |
| Runtime dependency: `chartjs-adapter-date-fns ^3.0.0` | Chart.js `TimeScale` requires a date adapter for calendar-date x-axis formatting. No built-in adapter ships with Chart.js. | Without adapter: manual tick formatting code (~50–80 lines), locale handling, custom display format logic — more complexity than the 3 KB adapter. |
| Runtime dependency: `date-fns ^3.0.0` | Required by `chartjs-adapter-date-fns`. Tree-shaken to ~5 KB gzip. | Cannot use adapter without its peer dependency. `date-fns` is tree-shakeable and well-maintained; no native `Intl` API covers the same formatting surface the adapter needs. |
