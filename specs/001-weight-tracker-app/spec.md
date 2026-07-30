# Feature Specification: Minimal Weight Tracker

**Feature Branch**: `001-weight-tracker-app`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User description: "A minimal weight tracking web app. The user can open the app in a
browser and log their current weight. Each entry includes the weight value and the date/time it
was recorded. All data is stored in the browser's local storage — no backend or authentication
required. The app displays a list of past entries. The UI must work on both desktop and mobile.
The app is built with plain HTML and TypeScript, and must be deployable as a standalone Docker
container serving static files."

## Clarifications

### Session 2026-03-13

- Q: Should data export be added to satisfy constitution Principle II (data ownership MUST)? → A: Add US4 (P2) — user can export all entries as a CSV or JSON file download, client-side Blob, no backend required.
- Q: What level of keyboard and accessibility support is required? → A: Basic keyboard accessibility — logical tab order, Enter submits the form, all interactive controls (submit, delete, export) must be reachable and activatable via keyboard alone.
- Q: What should happen when localStorage data is corrupt (unparseable JSON)? → A: Block the app from loading; show a recovery screen that explains the issue, offers a "Download raw data" option (to salvage whatever is stored), and a "Reset" option to clear and start fresh.
- Q: What should the exported file be named? → A: `weight-entries-YYYY-MM-DD.csv` / `weight-entries-YYYY-MM-DD.json` (date of export). Future versions should prepend a user name/profile identifier when multi-user support is added.
- Remediation I1 (analyze finding): FR-002 updated — new entries use the selected unit; existing entries display their stored unit label. No conversion on historical values.
- Remediation M3 (analyze finding): FR-008 already covers fluid layout 320–1023 px (applied previous session).
- Remediation I2 (analyze finding): tasks.md T013 and T016 updated to require `data-action="delete"` on delete buttons (applied to tasks.md — not spec).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a Weight Entry (Priority: P1)

A user opens the app in their browser and enters their current weight. They submit the entry
and immediately see it appear in their history. No account, login, or internet connection is
needed — the data lives entirely in the browser.

**Why this priority**: This is the core value proposition. Without the ability to record a
weight entry, nothing else in the app is useful.

**Independent Test**: Open the app in a browser, enter a valid weight value, submit the form,
and confirm the entry appears in the list with the correct timestamp. Refresh the page and
confirm the entry persists.

**Acceptance Scenarios**:

1. **Given** the app is open and the entry form is visible, **When** the user enters a valid
   weight value and submits, **Then** a new entry is added to the top of the history list
   containing the submitted weight and the current date/time.
2. **Given** an entry has been saved, **When** the user refreshes or re-opens the app,
   **Then** the previously saved entry is still present in the list.
3. **Given** the entry form is visible, **When** the user submits without entering a value
   or enters an implausible value (e.g., zero, negative, or outside a sane range),
   **Then** the entry is rejected and a clear error message is shown — no entry is created.

---

### User Story 2 - View Entry History (Priority: P2)

A user can review all previously logged weight entries. The list is ordered with the most
recent entry first so the user can quickly see their latest weight.

**Why this priority**: Logging is only useful if the user can review their history. This
story delivers the minimum needed to make logged data meaningful.

**Independent Test**: Log two or more entries and confirm they appear in the list ordered
newest-first, each showing the correct weight and timestamp. Can be fully tested without any
other user story beyond US1.

**Acceptance Scenarios**:

1. **Given** the user has previously logged entries, **When** they open the app, **Then**
   the full history list is displayed ordered from most recent to oldest.
2. **Given** the user has no logged entries, **When** they open the app, **Then** an
   empty-state message is shown (e.g., "No entries yet — log your first weight above.").
3. **Given** multiple entries exist, **When** the user adds a new entry, **Then** it appears
   at the top of the list immediately without requiring a page refresh.

---

### User Story 3 - Delete an Entry (Priority: P3)

A user can remove an individual weight entry they recorded in error. Deletion is permanent
and does not affect any other entries.

**Why this priority**: Data correction is important for accuracy, but it is non-blocking —
the app is fully usable without it.

**Independent Test**: Log two entries, delete one, and confirm only the remaining entry is
present after a page refresh.

**Acceptance Scenarios**:

1. **Given** one or more entries exist in the list, **When** the user chooses to delete a
   specific entry and confirms, **Then** that entry is removed from the list and does not
   reappear after a page refresh.
2. **Given** the user initiates a delete action, **When** prompted for confirmation and the
   user cancels, **Then** the entry is NOT removed.

---

### User Story 4 - Export Entries (Priority: P2)

A user can download all their weight entries as a file (CSV or JSON, their choice) directly
from the browser. No backend or network connection is required — the file is generated
entirely client-side and delivered as a browser file download.

**Why this priority**: Data ownership is a first-class concern (constitution Principle II).
Export enables the user to back up their data, migrate to another tool, or analyse it in a
spreadsheet. Rated P2 alongside history viewing because both serve the user's need to make
use of their recorded data.

**Independent Test**: With one or more entries logged, activate the export control, choose
a format (CSV or JSON), and confirm a file is downloaded to the device containing all
entries with correct field values.

**Acceptance Scenarios**:

1. **Given** one or more entries exist, **When** the user selects CSV export, **Then** a
   `.csv` file is downloaded containing one header row and one data row per entry, with
   columns: `date`, `time`, `weight`, `unit`.
2. **Given** one or more entries exist, **When** the user selects JSON export, **Then** a
   `.json` file is downloaded containing an array of all entries matching the storage
   schema (id, weightValue, unit, timestamp).
3. **Given** no entries exist, **When** the user activates an export option, **Then** the
   download is still triggered but contains an empty dataset (empty array for JSON; header
   row only for CSV) — no error is shown.
4. **Given** the user has entries in both kg and lbs (from preference changes over time),
   **When** they export, **Then** each entry's stored unit is preserved in the exported file.

---

### Edge Cases

- What happens when the user enters a weight value that is implausible (e.g., 0, negative,
  or above a defined maximum)?
- What happens when the browser's local storage quota is exhausted?
- What happens on a screen width of exactly 320 px (minimum supported mobile width)?
- Does the history list remain usable (scrollable, readable) when hundreds of entries exist?
- What happens when the user exports with no entries — does the app error or produce an
  empty file? (Resolved: produces an empty-but-valid file — see FR-011.)
- What happens when localStorage contains corrupt (unparseable) data on load? (Resolved:
  app shows a recovery screen with "Download raw data" and "Reset" options — see FR-013.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow the user to submit a new weight entry consisting of a weight
  value and an automatically captured timestamp.
- **FR-002**: The app MUST allow the user to select a global unit preference (kg or lbs). New
  entries are recorded in the currently selected unit. The preference MUST persist across
  sessions. The user MAY change the preference at any time; existing entries MUST continue to
  display their originally stored unit label — no conversion is applied to historical values.
- **FR-003**: The app MUST reject weight submissions that are empty, non-numeric, zero,
  negative, or outside a physically plausible range, and MUST display a clear error message.
- **FR-004**: The app MUST persist all entries in the browser so they survive page refreshes
  and browser restarts without requiring any server-side account or network connection.
- **FR-005**: The app MUST display all previously logged entries in reverse-chronological order
  (newest first), each showing the weight value and the date/time it was recorded.
- **FR-006**: The app MUST display a clear empty-state message when no entries have been logged.
- **FR-007**: The app MUST allow the user to delete any individual entry, with a confirmation
  step before the deletion is applied.
- **FR-008**: The app MUST present a fully functional and readable layout on both desktop
  screens (≥1024 px wide) and mobile screens (≥320 px wide) without horizontal scrolling.
  The layout MUST be fluid (no horizontal overflow) at all widths between 320 px and 1024 px.
- **FR-012**: All interactive controls (weight input, submit button, unit selector, delete
  buttons, export controls) MUST be reachable and activatable via keyboard alone. Tab order
  MUST follow a logical reading sequence. The entry form MUST submit when the user presses
  Enter while the weight input field is focused.
- **FR-013**: If the app detects corrupt or unparseable data in localStorage on startup, it
  MUST NOT silently discard the data or allow normal use. It MUST display a recovery screen
  that: (a) explains that the stored data could not be read, (b) offers a "Download raw data"
  action that triggers a download of the raw localStorage string for manual recovery, and
  (c) offers a "Reset" action that clears the corrupt data and reloads the app in a clean
  state.
- **FR-009**: The app MUST function entirely offline — no network request is required after the
  initial page load.
- **FR-010**: The app MUST be self-hostable as a single deployable unit containing only static
  files, with no server-side runtime, database, or external service required.
- **FR-011**: The app MUST allow the user to export all entries as a downloadable file in their
  choice of CSV or JSON format. The export MUST be performed entirely client-side (no network
  request). Exporting with zero entries MUST produce an empty-but-valid file rather than an
  error. Each entry's stored unit MUST be preserved in the exported file. The downloaded
  filename MUST follow the pattern `weight-entries-YYYY-MM-DD.csv` or
  `weight-entries-YYYY-MM-DD.json`, where the date is the date of export. (Future: prepend
  user name/profile when multi-user support is added.)

### Key Entities

- **Weight Entry**: A single record comprising a numeric weight value, a unit of measurement,
  and a timestamp (date and time captured automatically at submission). Entries are immutable
  once created; deletion is the only allowed modification.

## Assumptions

- **Timestamp source**: The timestamp is captured automatically from the user's device clock
  at the moment of submission. The user cannot manually override it.
- **Entry editing**: Entries cannot be edited after creation — only deleted and re-entered.
  This keeps the model simple and the history trustworthy.
- **Single user**: The app is designed for personal use by one individual per browser profile.
  No sharing or multi-device sync is in scope for this version. Data export (US4) is
  provided so the user owns and can move their data.
- **Data volume**: No upper limit on entry count is enforced by the app — browser storage
  limits apply naturally.
- **Offline-first**: No internet connection is needed after the page is first loaded. Export
  is also entirely client-side and requires no network connection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can log a new weight entry in under 30 seconds from opening the app.
- **SC-002**: All previously logged entries are visible immediately when the app is opened,
  with no perceptible loading delay.
- **SC-003**: The full app — entry form and history list — is usable without horizontal
  scrolling on any screen 320 px wide or wider.
- **SC-004**: A user can log an entry, close the browser tab, reopen the app, and see the
  entry still present — confirming durable local persistence across sessions.
- **SC-005**: The app can be deployed and accessed in a self-hosted environment with a single
  command or configuration step, requiring no external accounts or services.
- **SC-006**: 100% of empty or implausible weight submissions are rejected before saving, with
  a descriptive error message shown to the user.
- **SC-007**: A user can trigger a file download of all their entries in CSV or JSON format
  within 2 interactions (e.g., click format selector + click export button), with the file
  appearing in the browser's downloads folder without any error.
