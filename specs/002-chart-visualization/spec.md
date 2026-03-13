# Feature Specification: Weight Chart Visualization

**Feature Branch**: `002-chart-visualization`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User description: "Add a chart visualization to the weight tracking app. The chart displays the user's logged weight entries over time and renders four calculated lines..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Weight Trend Chart (Priority: P1)

As a user, I can see a chart of my logged weight entries over time with a trendline,
so that I can understand my overall weight direction at a glance.

**Why this priority**: The trendline chart delivers standalone value to any user
regardless of whether they have configured a goal. It is the foundation on which all
other chart features build and constitutes the usable MVP.

**Independent Test**: Log at least 2 entries, navigate to the chart — a line chart
appears with data points and a trendline overlaid. The chart is readable on a mobile
screen (320 px viewport) without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the user has 2 or more weight entries, **When** they view the chart,
   **Then** each entry appears as a data point at the correct date with the correct
   weight value (converted to the current preferred unit).
2. **Given** the user has 2 or more entries, **When** the chart renders, **Then** a
   trendline computed by linear regression over all per-day averages is displayed.
3. **Given** the user has only 1 entry, **When** they view the chart, **Then** the
   single data point is shown but no trendline is drawn.
4. **Given** the user has no entries, **When** they view the page, **Then** the
   chart section is not rendered at all — it becomes visible only once at least one
   entry exists.
5. **Given** the user is on a mobile device (viewport ≥ 320 px), **When** they view
   the chart, **Then** the chart is fully visible without horizontal scrolling and all
   axes and labels are legible.
6. **Given** the user logs a new entry, **When** the entry is saved, **Then** the
   chart updates to include the new data point without a page reload.
7. **Given** all entries fall on the same calendar day, **When** the chart renders,
   **Then** the trendline is omitted (division-by-zero guard) and only the single
   aggregated data point is shown.
8. **Given** the user has 2 or more entries spanning fewer than 7 days (calibration
   phase), **When** the chart renders, **Then** the trendline IS still displayed
   alongside data points — the calibration phase does not suppress the trendline.

---

### User Story 2 — Configure Goal and Chart Parameters (Priority: P2)

As a user, I can set my target weight goal and adjust convergence parameters in a
settings panel, so that the chart can show me a personalised target corridor.

**Why this priority**: Corridor lines (floor, ceiling, ideal) only become visible
once `weightGoal` is set. The settings panel is the prerequisite for US3. US1 still
delivers value without this story, so this is P2.

**Independent Test**: Click the settings button near the chart to open the modal,
enter a `weightGoal` value, save — confirm the value persists after a page refresh.
Confirm default values pre-populate for `lossRate`, `carbFatRatio`, and `bufferValue`.
Confirm closing the modal without saving does not persist changes.

**Acceptance Scenarios**:

1. **Given** the user opens the settings panel for the first time, **When** they view
   it, **Then** `lossRate` shows `0.0055`, `carbFatRatio` shows `0.6`, `bufferValue`
   shows `0.0075`, and `weightGoal` is empty.
2. **Given** the user enters a valid `weightGoal` and saves, **When** the page is
   refreshed, **Then** the saved `weightGoal` is still present.
3. **Given** the user enters a `weightGoal` of zero or a negative number, **When**
   they attempt to save, **Then** an error is displayed and no value is persisted.
4. **Given** the user enters an invalid value for any parameter (non-numeric, zero,
   negative), **When** they attempt to save, **Then** an error is displayed for that
   field and no change is persisted.
5. **Given** the user modifies any parameter and saves, **When** the chart
   re-renders, **Then** the corridor lines recalculate using the updated values.
6. **Given** the user clears `weightGoal` and saves, **When** the chart renders,
   **Then** corridor lines disappear and only the trendline and data points are shown.
7. **Given** the user opens the settings modal and makes changes, **When** they
   dismiss the modal without saving (cancel or Escape), **Then** no values are
   changed and the chart is unaffected.

---

### User Story 3 — View Corridor Lines (Priority: P2)

As a user who has set a weight goal, I can see floor, ceiling, and ideal convergence
lines on the chart, so that I know at a glance whether my weight trajectory is on
track, above, or below my personalised target corridor.

**Why this priority**: Corridor lines are the primary visualisation value for users
who have set a goal. They depend on US2 (goal configuration) being complete, but
share the P2 priority because they are part of the same goal-configuration experience.

**Independent Test**: With `weightGoal` set and at least 7 days of entries logged,
all three corridor lines (floor, ceiling, ideal) are visible from day 7 onward; days
1–6 show only data points and the trendline.

**Acceptance Scenarios**:

1. **Given** `weightGoal` is set and entries span at least 7 days, **When** the chart
   renders, **Then** floor, ceiling, and ideal lines are displayed starting from day
   7; days 1–6 show no corridor lines.
2. **Given** corridor lines are rendered, **When** the chart is viewed, **Then**
   `floor ≤ ideal ≤ ceiling` holds on every rendered day.
3. **Given** `weightGoal` is set and many days have elapsed, **When** the chart
   renders, **Then** floor and ceiling visually converge toward the goal weight over
   time.
4. **Given** `weightGoal` is set and the dataset has fewer than 7 days, **When** the
   chart renders, **Then** the trendline and data points are still displayed; no
   corridor lines appear; and a persistent informational message states that corridor
   lines require 7 days of data and a configured weight goal.
5. **Given** `weightGoal` is NOT set, **When** the chart renders, **Then** no floor,
   ceiling, or ideal lines appear — only the trendline (if ≥ 2 data points) and data
   points are visible — and the same informational message states that corridor lines
   require 7 days of data and a configured weight goal.

---

### Edge Cases

- What happens when all entries fall on the same calendar day? Trendline MUST be
  omitted rather than producing an undefined or infinite value.
- What happens when entries use mixed units (some kg, some lbs)? All values MUST be
  converted to the user's current preferred unit before any aggregation or
  calculation.
- What happens when `lossRate`, `carbFatRatio`, or `bufferValue` are set to zero?
  Corridor lines would never converge; input validation MUST reject zero and below.
- What happens when the dataset has entries on day 1 only but not days 2–6? The
  calibration average is taken over whatever measured entries exist in days 1–6 —
  missing days contribute nothing to the average.
- What happens when no measured entries exist in days 1–6 at all (e.g., the user's
  first entry is on day 8)? The earliest measured day's value is used as `startValue`
  for both floor and ceiling; corridor lines still render from day 7 onward using
  this fallback anchor.
- What happens when entries exist on day 1 and day 15 but not on days 2–14? Missing
  per-day values are filled by linear interpolation between the two nearest boundary
  data points. Interpolated values are used only as inputs to corridor calculations —
  they are NOT rendered as data points and do NOT influence the trendline regression.
- What happens with very large datasets (hundreds of entries)? Per-day averaging
  reduces plotted points to the number of distinct calendar days, keeping rendering
  performance acceptable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The chart MUST display each logged weight entry as a data point
  positioned at the correct date on the x-axis and the entry's weight (converted to
  the current preferred unit) on the y-axis.
- **FR-002**: When two or more entries exist across at least two distinct calendar
  days, the chart MUST render a trendline computed by linear regression over per-day
  average weights, where x = days elapsed since the first entry and y = per-day
  average weight.
- **FR-003**: When all entries fall on the same calendar day, the trendline MUST be
  omitted entirely.
- **FR-004**: When the user has no entries, the chart section MUST NOT be rendered —
  it is hidden entirely. The chart section becomes visible as soon as the user has at
  least one logged entry.
- **FR-004a**: When the user has exactly 1 entry, the chart renders (a single data
  point is shown) but the trendline is omitted.
- **FR-005**: When `weightGoal` is not set, the chart MUST render the trendline and
  data points (subject to the ≥ 2 data-point requirement for the trendline); a
  persistent informational message MUST state that corridor lines require 7 days of
  data and a configured weight goal.
- **FR-006**: When `weightGoal` is set but the dataset spans fewer than 7 calendar
  days, the chart MUST still render the trendline and data points (subject to the
  ≥ 2 data-point requirement); no corridor lines are shown; the same persistent
  informational message MUST state that corridor lines require 7 days of data and a
  configured weight goal.
- **FR-007**: When `weightGoal` is set and the dataset spans at least 7 calendar
  days, the chart MUST display floor, ceiling, and ideal lines starting from day 7.
  Days 1–6 are a calibration phase — no corridor lines are drawn for those days.
- **FR-008**: The floor line MUST be calculated as:
  - `startValue` = average weight of measured entries in days 1–6; if no measured
    entries exist in days 1–6, fall back to the value of the earliest measured day
    in the dataset
  - `floor(day 7)` = `startValue − (startValue × bufferValue × 0.5)`
  - `floor(day n)` = `floor(n−1) − (floor(n−1) − weightGoal) × lossRate`
- **FR-009**: The ceiling line MUST be calculated as:
  - `startValue` = same derivation as FR-008 (calibration average with fallback)
  - `ceiling(day 7)` = `startValue + (startValue × bufferValue × 0.5)`
  - `adjustedGoal` = `weightGoal + (weightGoal × bufferValue)`
  - `ceiling(day n)` = `ceiling(n−1) − (ceiling(n−1) − adjustedGoal) × lossRate × carbFatRatio`
- **FR-010**: The ideal line MUST be calculated as:
  `ideal(day n) = (floor(day n) + ceiling(day n)) / 2`
- **FR-011**: All domain calculations (regression, floor, ceiling, ideal) MUST be
  encapsulated in a dedicated calculation module with pure functions and clearly
  defined inputs/outputs. The chart rendering component MUST receive only
  pre-computed data point arrays and MUST NOT contain any domain logic.
- **FR-012**: The settings panel MUST expose four user-configurable parameters:
  `weightGoal` (no default; required to unlock corridor lines), `lossRate` (default
  `0.0055`), `carbFatRatio` (default `0.6`), `bufferValue` (default `0.0075`).
- **FR-013**: All chart settings MUST be persisted in local browser storage and
  survive a page refresh.
- **FR-014**: Settings validation MUST reject: `weightGoal` ≤ 0; `lossRate` ≤ 0;
  `carbFatRatio` ≤ 0; `bufferValue` ≤ 0; any non-numeric input. Each invalid field
  MUST surface a specific user-facing error and the invalid value MUST NOT be
  persisted.
- **FR-015**: When entries use mixed units, all values MUST be converted to the
  user's currently selected preferred unit before any chart calculation or rendering.
  Additionally, when the user changes their preferred unit, the chart MUST immediately
  re-compute (calling `computeChartData` with the new unit) and re-render without
  requiring a page reload.
- **FR-016**: The chart MUST be fully usable on viewports from 320 px to 1280 px
  wide with no horizontal scrolling and legible axis labels at all sizes.
- **FR-021**: The x-axis MUST display calendar dates in a human-readable format
  (e.g. "13 Mar" or "13 Mar 2026"). Day-index numbers (e.g. "Day 1", "Day 7") MUST
  NOT be shown to the user. Date formatting MUST use the user's local calendar.
- **FR-019**: The chart section MUST be positioned at the top of the page, above the
  entry form. It MUST be hidden when no entries exist and appear automatically once
  the first entry is logged.
- **FR-020**: Chart parameters (`weightGoal`, `lossRate`, `carbFatRatio`,
  `bufferValue`) MUST be edited via a modal dialog. A settings button on or
  immediately adjacent to the chart MUST open the modal. The modal MUST be
  dismissible without saving via: the Cancel button, the Escape key, or clicking
  the backdrop outside the modal — all three dismiss the modal and discard unsaved
  changes. The modal MUST be keyboard-accessible (focusable controls, tab cycles
  within modal). Pressing Enter while a settings input is focused MUST NOT submit
  the form or close the modal — the Save button must be clicked or activated
  explicitly to persist changes.
- **FR-017**: Adding a new weight entry MUST update the chart (data points and
  trendline; corridor lines if applicable) without requiring a page reload.
- **FR-018**: When the dataset contains calendar days with no logged entries between
  days that do have entries (gaps), the missing per-day average values MUST be filled
  by linear interpolation between the two nearest boundary data points. Interpolated
  values are used solely as inputs to floor, ceiling, and ideal calculations to
  produce continuous corridor lines; they MUST NOT be rendered as data points on the
  chart and MUST NOT be included in the trendline regression.

### Key Entities

- **ChartSettings**: The four user-configurable parameters — `weightGoal` (optional
  positive number), `lossRate`, `carbFatRatio`, `bufferValue` (all positive numbers
  with defaults).
- **DailyAverage**: A per-calendar-day value used as input to all line calculations —
  date, average weight in the current preferred unit, and an origin flag
  (`measured` | `interpolated`). Measured values come from actual logged entries.
  Interpolated values are generated by linear interpolation to fill calendar-day gaps
  between measured days; they are used for corridor calculations only and are never
  stored or rendered as chart data points.
- **ChartDataSet**: The pre-computed output consumed by the rendering layer — arrays
  of `(date, value)` pairs for: data points, trendline, floor, ceiling, and ideal,
  where `date` is a calendar date. The x-axis MUST display calendar dates (e.g.
  "13 Mar", "14 Mar 2026"). Day indices are an internal calculation detail only;
  the rendering layer always works with calendar dates. The rendering layer accepts
  only this structure and contains no domain logic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with at least 2 logged entries sees the chart with data points
  and a trendline within 1 second of navigating to the chart view, with no additional
  interaction required.
- **SC-002**: A user can configure their weight goal and have all corridor lines
  appear on the chart in at most 2 interactions (open settings → save).
- **SC-003**: The invariant `floor ≤ ideal ≤ ceiling` holds on every rendered day
  when `weightGoal` is set — verified by automated tests over a range of parameter
  combinations.
- **SC-004**: The chart renders without horizontal overflow on a 320 px wide viewport
  with all data points, lines, and axis labels visible.
- **SC-005**: Adding a new weight entry updates the chart in-place without a page
  reload.
- **SC-006**: Chart settings (including `weightGoal`) persist across browser sessions
  — reloading the page does not reset them to defaults.
- **SC-007**: The calculation module can be replaced (e.g., swapped for a backend API
  call) without any changes to the chart rendering component.

## Assumptions

- "Days since first entry" uses calendar days (midnight-to-midnight in the user's
  local timezone), not rolling 24-hour windows.
- When multiple entries exist on the same calendar day, they are averaged into a
  single data point for chart purposes; stored entries remain unaggregated.
- `weightGoal` is stored as a numeric value in the user's currently selected
  preferred unit. If the user changes unit preference after setting a goal, the stored
  numeric value is retained without conversion — consistent with how existing entries
  are handled.
- The calibration average (days 1–6) uses whatever entries exist in that window; days
  with no entries are excluded from the average (not treated as zero).
- The charting library or canvas/SVG approach is a planning-phase decision; this spec
  does not mandate one.
- No backend is required for this iteration; all data and settings remain in local
  browser storage. Backend migration is planned for a future iteration.

## Constraints

- All domain calculations (regression, floor, ceiling, ideal) MUST reside in an
  isolated calculation module. The rendering component MUST NOT contain any domain
  logic — it only consumes pre-computed data point arrays. This constraint exists
  explicitly to enable a future migration where the calculation module is replaced by
  a backend API call with no impact on the rendering layer.
- No new runtime dependencies should be introduced unless the chosen charting
  approach has no reasonable built-in browser alternative. Any added dependency MUST
  be justified in the plan's Complexity Tracking table.
- A dedicated `tests/chart.test.ts` file MUST be created for Chart.js integration
  tests covering: canvas element existence after `renderChart()`, correct series
  count matching `ChartDataSet` contents, and absence of canvas-reuse errors on
  successive renders.
- Chart settings storage (`loadChartSettings` / `saveChartSettings`) MUST be
  initialized and available before any chart rendering or `computeChartData` call.
  In the foundational implementation phase, storage setup MUST precede all read
  operations that depend on persisted settings.

## Clarifications

### Session 2026-03-13

- Q: During calibration (< 7 days of data), does the trendline still render, and what message is shown when corridor lines are unavailable? → A: Trendline renders during calibration if ≥ 2 data points exist. A single persistent informational message — "corridor lines require 7 days of data and a configured weight goal" — is shown whenever corridor lines cannot be displayed, whether the blocker is the calibration phase, a missing `weightGoal`, or both. The trendline and data points are always visible when they meet their own rendering conditions, regardless of corridor-line eligibility.
- Q: When the dataset contains calendar-day gaps (days with no logged entries between days that do), how are corridor lines handled for those days? → A: Missing per-day values are filled by linear interpolation between the two nearest boundary data points. Interpolated values feed corridor calculations only — they are not rendered as chart data points and do not influence the trendline regression.
- Q: Where does the chart appear in the page layout, and how is it handled when there is no data? → A: The chart section is positioned at the top of the page, above the entry form. It is not rendered at all when no entries exist; it appears automatically once the first entry is logged.
- Q: How is the settings panel for chart parameters surfaced in the UI? → A: A modal dialog opened via a settings button on or adjacent to the chart. The modal is dismissible without saving (cancel or Escape discards changes) and must be fully keyboard-accessible.
- Q: When `weightGoal` is set but no measured entries exist in days 1–6 (calibration window), what anchors the corridor calculation? → A: Fall back to the earliest measured day's value as `startValue`. Corridor lines still render from day 7 onward using this fallback anchor.
- Q: What does the chart x-axis display — calendar dates or relative day numbers? → A: Calendar dates (e.g. "13 Mar", "14 Mar 2026") in the user's local format. Day indices are an internal calculation detail only and are never shown to the user.

### Session 2026-03-13 (post-analysis)

- Q: Must the chart re-render when the user changes their preferred unit mid-session? → A: Yes. When the user changes their preferred unit, the chart must immediately re-compute (calling `computeChartData` with the new unit) and re-render without a page reload. Applied to FR-015.
- Q: Must the settings modal guard against accidental form submission via the Enter key? → A: Yes. Pressing Enter while a settings input is focused must not submit the form or close the modal; the Save button must be clicked or activated explicitly. Applied to FR-020.
- Q: Does clicking the backdrop (outside the modal) dismiss the settings modal? → A: Yes. Clicking the backdrop closes the modal and discards unsaved changes, identical to Cancel and Escape. Applied to FR-020.
- Q: Is a dedicated `tests/chart.test.ts` file required for Chart.js rendering tests? → A: Yes. A dedicated `tests/chart.test.ts` must cover canvas existence after render, correct series count, and no canvas-reuse errors on successive renders. Applied to Constraints.
- Q: Must chart settings storage be initialized before it is read in the foundational phase? → A: Yes. `loadChartSettings`/`saveChartSettings` must be available before any `computeChartData` or rendering call; storage setup precedes all read operations in the foundational phase. Applied to Constraints.
