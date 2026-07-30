# Tasks: Weight Chart Visualization

**Input**: Design documents from `/specs/002-chart-visualization/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**TDD**: Test tasks appear before implementation tasks in every phase. Tests MUST be written first and confirmed failing before any implementation begins (Constitution III).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no mutual dependency)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Install new runtime dependencies required by research.md Decision 1

- [x] T001 Install chart.js, chartjs-adapter-date-fns, and date-fns npm packages (`npm install chart.js@^4 chartjs-adapter-date-fns@^3 date-fns@^3`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions and storage layer that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Add `ChartPoint`, `ChartSettings`, `DailyAverage`, `ChartDataSet`, and `CorridorState` type definitions to `src/ts/model.ts` — use exact interfaces from `contracts/chart-calculations-contract.md`
- [x] T003 [P] Write failing tests for `loadChartSettings` and `saveChartSettings` in `tests/storage.test.ts`: save then load round-trip, absent key returns defaults, `weightGoal: null` round-trip (write FIRST — tests must fail before T004 implements the functions)
- [x] T004 Add `loadChartSettings()` and `saveChartSettings()` functions to `src/ts/storage.ts` using key `weight_tracker_chart_settings`; `loadChartSettings` returns defaults (`lossRate: 0.0055`, `carbFatRatio: 0.6`, `bufferValue: 0.0075`, `weightGoal: null`) when key absent (depends T003 confirmed failing; C5: storage MUST be fully implemented before any `computeChartData` or rendering call in Phase 3+)

**Checkpoint**: Type definitions and settings storage ready — user story phases can now begin

---

## Phase 3: User Story 1 — View Weight Trend Chart (Priority: P1) 🎯 MVP

**Goal**: Render a Chart.js line chart with data points and a trendline above the entry form; chart hidden when no entries exist; updates live when an entry is added or deleted.

**Independent Test**: Log at least 2 entries on different calendar days — a line chart appears with a trendline. Log 1 entry — chart appears with a single point and no trendline. Clear all entries — chart section disappears entirely. Chart is fully visible at 320 px viewport width.

> **NOTE: Write all tests in this section FIRST and confirm they FAIL before writing any implementation**

### Tests for User Story 1 (TDD — write and verify failing first) ⚠️

- [x] T005 [US1] Write failing tests for `buildDailyAverages` in `tests/chart-calculations.test.ts`: same-day entries average to one point, mixed-unit entries convert to `preferredUnit`, output sorted ascending by `dayIndex`, all origins marked `"measured"`, empty input returns `[]`
- [x] T006 [US1] Write failing tests for `computeTrendline` in `tests/chart-calculations.test.ts`: returns `null` for `< 2` distinct measured days, returns `null` when all entries on same day (`Σ(xi-x̄)² = 0` guard), returns 2-point array spanning first-to-last day index with correct slope/intercept for known inputs (append to same file as T005)
- [x] T007 [US1] Write failing tests for `computeChartData` US1 scenarios in `tests/chart-calculations.test.ts`: empty entries → `corridorState: "no-data"` + empty arrays; 1 entry → 1 `dataPoint` + `trendline: null`; 2 entries same day → `trendline: null`; 2 entries different days → `trendline` present + `corridorState: "no-goal"` (append to same file)
- [x] T008 [P] [US1] Write failing chart-section visibility tests in `tests/ui.test.ts`: `#chart-section` has `hidden` attribute when no entries, `hidden` removed when 1+ entries logged, re-hidden when all entries deleted (different file — can run parallel to T005–T007)

### Implementation for User Story 1

- [x] T009 [US1] Create `src/ts/chart-calculations.ts`; implement `buildDailyAverages(entries, preferredUnit)`: convert each entry to `preferredUnit`, group by calendar day (local timezone midnight), average weights per day, assign 0-based `dayIndex`, mark all as `origin: "measured"`, return sorted array — gap interpolation scaffold left as stub for US3 (depends T005 confirmed failing)
- [x] T010 [US1] Implement `computeTrendline(measured)` in `src/ts/chart-calculations.ts`: OLS linear regression over `dayIndex`/`avgWeight` pairs, `null` guard for `< 2` distinct indices or `Σ(xi-x̄)² = 0`, return `[{date: firstMeasuredDate, value: trendY(0)}, {date: lastMeasuredDate, value: trendY(n)}]` (depends T006, T009)
- [x] T011 [US1] Implement `computeChartData(entries, settings, preferredUnit)` in `src/ts/chart-calculations.ts` for US1 path: call `buildDailyAverages`, call `computeTrendline`, set `corridorState` to `"no-data"` / `"no-goal"` / `"calibrating"` (corridor lines all `null`), export `buildDailyAverages` and `computeTrendline` for tests (depends T007, T010)
- [x] T012 [P] [US1] Add `#chart-section` DOM structure to `src/index.html` as first child of `<main>`: `<section id="chart-section" hidden>` containing `<div id="chart-container">`, `<div id="chart-info-msg" role="status" aria-live="polite">`, and `<button id="chart-settings-btn" type="button" aria-label="Configure chart settings">Settings</button>` — match `contracts/ui-contract.md` exactly
- [x] T013 [P] [US1] Write failing integration tests for `chart.ts` in `tests/chart.test.ts`: `renderChart()` returns a `Chart` instance, canvas element exists in DOM after render, destroying and re-calling does not throw, series count in chart data matches `dataPoints`-only `ChartDataSet` (no corridor); mark file as new (C4 fix; parallel — written before T013b implementation)
- [x] T013b [US1] Create `src/ts/chart.ts`: import `Chart`, `LineController`, `LineElement`, `PointElement`, `LinearScale`, `TimeScale`, `Tooltip`, `Legend`, `Filler` from `chart.js` and the date adapter; call `Chart.register(...)`; export `renderChart(canvas: HTMLCanvasElement, dataset: ChartDataSet, preferredUnit: WeightUnit): Chart` — renders data points and trendline series only; `animation: false`; `responsive: true`; `maintainAspectRatio: false`; x-axis `type: "time"`, `time.unit: "day"`, `time.displayFormats.day: "d MMM"`; y-axis `title.display: true`, `title.text: preferredUnit` (depends T001, T011, T013 confirmed failing)
- [x] T014 [P] [US1] Add chart styles to `src/css/main.css`: `#chart-section:not([hidden]) { display: block }`, `#chart-container { height: 260px; width: 100% }`, `@media (min-width: 768px) { #chart-container { height: 320px } }`, `#chart-info-msg { … }` placeholder (different file — parallel with T012, T013)
- [x] T015 [US1] Add `showChartSection()` and `hideChartSection()` helpers to `src/ts/ui.ts`: toggle the `hidden` attribute on `#chart-section`; wire `#chart-info-msg` text from `CorridorState` — `"no-goal"` and `"calibrating"` show `"Corridor lines require 7 days of data and a configured weight goal."`, `"ready"` clears it (depends T008, T012)
- [x] T016 [US1] Wire chart into `src/ts/main.ts`: on DOMContentLoaded call `loadChartSettings()`, `loadEntries()`, `computeChartData()`, and `renderChart()` or `hideChartSection()` based on entry count; re-call on every entry add and delete to update chart in-place; keep reference to `Chart` instance and call `chart.destroy()` before re-render to avoid canvas reuse error (depends T011, T013, T015)
- [x] T016a [P] [US1] Write failing test for unit-preference-change re-render in `tests/ui.test.ts`: switching preferred unit fires the unit-change event and triggers `computeChartData` + `renderChart` with the new unit — chart canvas data updates without page reload (C1 fix; parallel — different file concern from T016)
- [x] T016b [US1] Wire unit-preference-change event in `src/ts/main.ts`: listen for the existing unit-preference-change event/callback from `preferences.ts`; on change, re-call `computeChartData(entries, settings, newUnit)` and `renderChart` — chart updates immediately without page reload (depends T016, T016a confirmed failing; FR-015)

**Checkpoint**: US1 fully testable. Log entries, see chart with trendline. Delete all entries, chart hides. Visible at 320 px.

---

## Phase 4: User Story 2 — Configure Goal and Chart Parameters (Priority: P2)

**Goal**: A settings modal (native `<dialog>`) lets the user set `weightGoal` and adjust `lossRate`, `carbFatRatio`, `bufferValue`; values persist to `localStorage`; closing without saving discards changes.

**Independent Test**: Click Settings button — modal opens with default values pre-populated. Enter a `weightGoal`, save — modal closes, value persists after page refresh. Enter `-10` — error shown, nothing saved. Press Escape — modal closes with no change.

> **NOTE: Write all tests in this section FIRST and confirm they FAIL before writing any implementation**

### Tests for User Story 2 (TDD — write and verify failing first) ⚠️

- [x] T017 [US2] Write failing validation tests in `tests/chart-calculations.test.ts`: `weightGoal` ≤ 0 invalid, `weightGoal: null` valid (optional), `lossRate` ≤ 0 invalid, `carbFatRatio` ≤ 0 invalid, `bufferValue` ≤ 0 invalid, non-numeric string invalid for each field — each produces the exact error message from `data-model.md` (append to existing file)
- [x] T018 [P] [US2] Write failing settings modal tests in `tests/ui.test.ts`: clicking `#chart-settings-btn` calls `showModal()` on `#chart-settings-modal`, inputs are pre-populated with defaults on open, clicking `#settings-cancel-btn` calls `close()` without persisting, Escape key closes modal, backdrop click closes modal (dispatching a `click` on the `<dialog>` element itself), Enter keydown in an input does NOT trigger save (C2/C3 fixes; different file — parallel with T017)

### Implementation for User Story 2

- [x] T019 [US2] Add `<dialog id="chart-settings-modal">` structure to `src/index.html`: `<h2 id="settings-modal-title">Chart Settings</h2>`, `<form id="chart-settings-form" method="dialog">` with inputs and error spans for `weight-goal-input`, `loss-rate-input`, `carb-fat-ratio-input`, `buffer-value-input`; Save and Cancel buttons — match `contracts/ui-contract.md` exactly (depends T017 confirmed failing)
- [x] T020 [P] [US2] Add settings modal CSS to `src/css/main.css`: `#chart-settings-modal` backdrop dimming via `::backdrop`, modal `max-width`, form layout, error span `color: red`, input invalid state (parallel — different file)
- [x] T021 [US2] Implement `openSettingsModal()` and `closeSettingsModal()` in `src/ts/main.ts`: `openSettingsModal` calls `dialog.showModal()` and pre-populates inputs from `loadChartSettings()`, moves focus to first input; `closeSettingsModal` calls `dialog.close()`; wire `#chart-settings-btn` click → open, `#settings-cancel-btn` click → close, `dialog` cancel event (Escape) → close, backdrop click → close (add `click` listener on `<dialog>` that checks `event.target === dialog`); add `keydown` listener on the form that calls `event.preventDefault()` when `Enter` is pressed while a text/number input is focused — the Save button must be the only submit path (C2/C3 fixes; depends T018, T019)
- [x] T022 [US2] Implement settings form save logic in `src/ts/main.ts`: on `#settings-save-btn` click, read and validate all four inputs against `data-model.md` validation rules, display inline errors on failure (keep modal open), on all-pass call `saveChartSettings()` then close modal and re-render chart with updated settings (depends T017, T021, T003)

**Checkpoint**: US2 fully testable independent of US3. Settings persist after refresh. Invalid inputs rejected with field-level errors.

---

## Phase 5: User Story 3 — View Corridor Lines (Priority: P2)

**Goal**: When `weightGoal` is set and entries span ≥ 7 calendar days, floor, ceiling, and ideal lines render starting from day 7. Gap interpolation fills missing days for corridor calculations only.

**Independent Test**: Seed 8 entries across 8 days with `weightGoal` set — floor, ceiling, ideal lines appear from day 7 onward; days 1–6 show data points and trendline only. Seed entries with a 14-day gap — corridor lines render continuously across the gap without breaks.

> **NOTE: Write all tests in this section FIRST and confirm they FAIL before writing any implementation**

### Tests for User Story 3 (TDD — write and verify failing first) ⚠️

- [x] T023 [US3] Write failing tests for `computeCorridorLines` (corridor formulas) in `tests/chart-calculations.test.ts`: floor formula at day 6 and day n, ceiling formula at day 6 and day n, ideal = (floor+ceiling)/2, `floor[n] ≤ ideal[n] ≤ ceiling[n]` invariant over 30 days, `null` when `weightGoal` is null (append to existing file)
- [x] T024 [US3] Write failing tests for `computeCorridorLines` (gate and calibration) in `tests/chart-calculations.test.ts`: returns `null` when measured days < 7, returns non-null when exactly 7 measured days, calibration average uses only `origin: "measured"` entries in days 0–5, calibration falls back to earliest measured day when days 0–5 empty (append to same file)
- [x] T025 [US3] Write failing tests for gap interpolation in `buildDailyAverages` in `tests/chart-calculations.test.ts`: entries on day 0 and day 14 → 15 `DailyAverage` entries returned (13 interpolated), interpolated entry at day 7 has correct linear-interpolation value, interpolated entries have `origin: "interpolated"`, no interpolation before first or after last measured day (append to same file)

### Implementation for User Story 3

- [x] T026 [US3] Implement linear gap interpolation in `buildDailyAverages` in `src/ts/chart-calculations.ts`: after building measured array, iterate `dayIndex` 0..maxIndex, for each missing index between two measured entries compute `t = (d-prev.dayIndex)/(next.dayIndex-prev.dayIndex)` and `w = prev.avgWeight + (next.avgWeight-prev.avgWeight)*t`, mark `origin: "interpolated"` — days before first and after last measured entry are NOT interpolated (depends T025)
- [x] T027 [US3] Implement `computeCorridorLines(dailyAverages, settings)` in `src/ts/chart-calculations.ts`: export function; compute `startValue` from measured entries in `dayIndex` 0–5 (average) with fallback to earliest measured; compute floor/ceiling/ideal arrays starting at `dayIndex === 6` using formulas from `data-model.md`; return `null` when `settings.weightGoal` is null or when measured days < 7 (depends T023, T024, T026)
- [x] T028 [US3] Update `computeChartData` in `src/ts/chart-calculations.ts` to call `computeCorridorLines`; set `corridorState: "ready"` and populate `floor`/`ceiling`/`ideal` when corridor is non-null; export `computeCorridorLines` for tests (depends T027)
- [x] T029 [US3] Add floor, ceiling, and ideal series to `renderChart` in `src/ts/chart.ts`: each as a dataset with `pointRadius: 0`, `borderWidth: 1.5`, `borderDash: [4, 4]`, `tension: 0`; floor = green, ceiling = red, ideal = purple; only added to chart when the array is non-null in `ChartDataSet` (depends T028)
- [x] T030 [US3] Wire `corridorState` to `#chart-info-msg` visibility in `src/ts/main.ts`: after every `computeChartData` call, show the informational message when `corridorState === "no-goal"` or `"calibrating"`, hide it when `"ready"` (depends T028, T015)

**Checkpoint**: All 3 user stories functional. Corridor lines appear from day 7. Gap interpolation produces continuous lines. Invariant `floor ≤ ideal ≤ ceiling` holds.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and edge-case verification

- [x] T031 [P] Run `npm test && npm run lint` from repository root; resolve any test failures or lint errors (133/133 tests pass; no lint script configured in this project — lint step N/A)
- [x] T032 [P] Verify `#chart-section` is the first child of `<main>` in `src/index.html` (above entry form) per FR-019 and `contracts/ui-contract.md` (confirmed: line 31)
- [ ] T033 Run all 9 manual checkpoints from `specs/002-chart-visualization/quickstart.md` in a browser; document any failures as new bug tasks (requires manual browser execution)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — no dependency on US2 or US3
- **US2 (Phase 4)**: Depends on Phase 2 — can begin after Phase 2; no dependency on US1 being complete (settings storage was built in Phase 2)
- **US3 (Phase 5)**: Depends on US2 (corridor formulas require `ChartSettings.weightGoal`); depends on US1 (rendering layer and `computeChartData` must exist)
- **Polish (Phase 6)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Foundational complete → implement immediately
- **US2 (P2)**: Foundational complete → can implement in parallel with US1
- **US3 (P2)**: US1 + US2 complete → implement last

### Within Each Phase

1. Write ALL test tasks for the phase first; confirm each failing before proceeding
2. `model.ts` types before any implementation that imports them
3. `storage.ts` functions before `main.ts` wiring
4. `chart-calculations.ts` functions before `chart.ts` rendering
5. `index.html` DOM structure before `ui.ts` / `main.ts` DOM queries
6. Commit after each completed phase (Constitution — Commit Cadence)

### Parallel Opportunities

- T003 (tests) runs before T004 (implementation) — write tests first; they are in different files so drafting can overlap with T002
- T005–T007 are sequential (same file); T008, T013 are parallel (different files)
- T012, T013, T013b, T014 — T013 (test) and T012/T014 can run in parallel (different files); T013b (impl) depends on T013 failing confirmed
- T017 and T018 can run in parallel (different files: chart-calculations.test.ts, ui.test.ts)
- T019 and T020 can run in parallel (different files: index.html, main.css)
- T031 and T032 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Write tests in parallel for US1 (two files simultaneously):
Task T005:    "Write failing buildDailyAverages tests in tests/chart-calculations.test.ts"
Task T008:    "Write failing chart-section visibility tests in tests/ui.test.ts"        [P]
Task T013:    "Write failing chart.ts integration tests in tests/chart.test.ts"         [P]

# After tests confirmed failing, implement in parallel (three files simultaneously):
Task T012:    "Add #chart-section DOM to src/index.html"                                [P]
Task T013b:   "Create src/ts/chart.ts with Chart.js renderChart()"                      [P]
Task T014:    "Add chart container CSS to src/css/main.css"                             [P]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: User Story 1 (T005–T016)
4. **STOP and VALIDATE**: `npm test`, open browser, verify quickstart.md Checkpoints 1–2
5. Demo chart with trendline — delivers SC-001, SC-004, SC-005 from spec

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Trendline chart ✅ Demo
3. Phase 4 (US2) → Settings modal ✅ Demo
4. Phase 5 (US3) → Corridor lines ✅ Demo
5. Phase 6 → Polish + quickstart validation

---

## Notes

- TDD is mandatory per Constitution III: write test → confirm failing → implement → confirm passing
- Commit after each completed phase using imperative mood and phase reference (e.g., `feat(phase-3): add trendline chart`)
- The `Chart` instance in `main.ts` MUST be destroyed before re-creating to avoid Chart.js "Canvas is already in use" error
- `#recovery-screen:not([hidden])` CSS pattern (from 001 bug fix) already set — same pattern applies to `#chart-section:not([hidden])` if flex layout is needed
- `corridorState` drives both chart-section visibility (T015/T016) AND info message visibility (T030) — centralise this check to avoid duplication
