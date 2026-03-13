---

description: "Task list for Minimal Weight Tracker — 001-weight-tracker-app"
---

# Tasks: Minimal Weight Tracker

**Input**: Design documents from `/specs/001-weight-tracker-app/`
**Prerequisites**: plan.md ✅, spec.md ✅ (v2 — US4/FR-011/FR-012/FR-013 added), research.md ✅,
data-model.md ✅, contracts/ ✅

**Tests**: Included — constitution mandates TDD (Principle III, NON-NEGOTIABLE). Tests MUST
be written first and confirmed failing before implementation begins in every phase.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.
Each story phase ends with a checkpoint validated via quickstart.md.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in every task description

## Path Conventions

Single project — `src/`, `tests/` at repository root:

```text
src/
├── index.html
├── css/main.css
└── ts/
    ├── main.ts
    ├── model.ts
    ├── storage.ts
    ├── preferences.ts
    ├── ui.ts
    └── export.ts          ← new: US4 export logic
tests/
├── model.test.ts
├── storage.test.ts
├── ui.test.ts
└── export.test.ts         ← new: US4 + export unit tests
Dockerfile
nginx.conf
package.json  /  tsconfig.json  /  vite.config.ts  /  vitest.config.ts
```

---

## Phase 1: Setup

**Purpose**: Initialize project toolchain and scaffolding — no logic yet.

- [ ] T001 Create package.json with devDependencies: `typescript`, `vite`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@types/node`; define scripts: `dev`, `build`, `preview`, `test`, `test:watch`
- [ ] T002 [P] Create tsconfig.json targeting ES2020, `"lib": ["ES2020", "DOM"]`, `strict: true`, source root `src/ts`
- [ ] T003 [P] Create vite.config.ts with `build.outDir: "dist"` and `root: "src"`
- [ ] T004 [P] Create vitest.config.ts with `environment: "jsdom"` and `include: ["tests/**/*.test.ts"]`
- [ ] T005 [P] Create directory structure: `src/css/`, `src/ts/`, `tests/`
- [ ] T006 [P] Create Dockerfile — multi-stage: stage 1 uses `node:20-alpine` to run `npm ci && npm run build`; stage 2 uses `nginx:alpine` and copies `dist/` to `/usr/share/nginx/html`
- [ ] T007 [P] Create nginx.conf — serve static files from `/usr/share/nginx/html`; set correct MIME types; return `index.html` for all routes; configure cache headers for JS/CSS assets

---

## Phase 2: Foundational

**Purpose**: Core types, storage layer, and startup integrity check (FR-013) — MUST be
complete before any user story begins. All stories depend on these modules.

**⚠️ CRITICAL**: Write each test task first — confirm it FAILS — then implement.

- [ ] T008 Write failing tests for WeightEntry validation in `tests/model.test.ts`: valid kg (1–635), valid lbs (2–1400), empty → error, zero → error, negative → error, above-range kg → error, above-range lbs → error, non-numeric → error; test `createEntry()` stamps a UUID `id` via `crypto.randomUUID()` and ISO `timestamp` via `new Date().toISOString()`
- [ ] T009 Implement `src/ts/model.ts` — `WeightEntry` interface `{id, weightValue, unit, timestamp}`; `UserPreferences` interface `{unit: "kg" | "lbs"}`; `WeightUnit` type; `validateWeight(raw: string, unit: WeightUnit): {valid: boolean; error?: string}`; `createEntry(weightValue: number, unit: WeightUnit): WeightEntry` (depends on T008 failing)
- [ ] T010 [P] Write failing tests for localStorage operations in `tests/storage.test.ts`: `loadEntries()` returns `[]` when key absent; `loadEntries()` returns `[]` when stored JSON is corrupt AND sets an internal corrupt-data flag; `saveEntries()` + `loadEntries()` round-trip preserves all fields; `loadEntries()` sorts descending by timestamp; `loadPreferences()` returns `{unit: "kg"}` when absent; `savePreferences()` + `loadPreferences()` round-trip; `saveEntries()` throws user-facing error on `QuotaExceededError`; `isDataCorrupt()` returns `true` only when corrupt JSON was detected on last load; `getRawStorageString()` returns the raw string value of the entries key
- [ ] T011 Implement `src/ts/storage.ts` — keys `ENTRIES_KEY = "weight_tracker_entries"`, `PREFS_KEY = "weight_tracker_preferences"`; internal `_dataCorrupt` flag set when `JSON.parse` throws; `loadEntries(): WeightEntry[]` (parse + null-guard + sort desc; set `_dataCorrupt = true` on SyntaxError); `saveEntries(entries: WeightEntry[]): void` (stringify + try/catch QuotaExceededError); `loadPreferences(): UserPreferences`; `savePreferences(prefs: UserPreferences): void`; `isDataCorrupt(): boolean`; `getRawStorageString(): string` (returns raw localStorage value for recovery download) (depends on T010 failing)
- [ ] T012 [P] Create `src/ts/preferences.ts` — `getUnit(): WeightUnit`; `setUnit(unit: WeightUnit): void`; delegates to `storage.ts`; re-exports `WeightUnit`
- [ ] T013 [P] Create `src/index.html` — app shell with: `<div id="recovery-screen" hidden>` (recovery screen container); `<div id="app">` wrapping: page title, `<select id="unit-select">`, `<input id="weight-input" type="number" step="0.1" min="0">`, submit `<button id="submit-btn">Log Weight</button>`, `<div id="error-msg" role="alert">`, `<div id="entry-list">`; export section: `<select id="export-format">` (options: CSV, JSON), `<button id="export-btn">Export</button>`; all controls have descriptive `aria-label` attributes; logical tab order; link `css/main.css`; script `ts/main.ts`; note: delete buttons rendered dynamically MUST carry both `data-id="<uuid>"` AND `data-action="delete"` attributes
- [ ] T014 [P] Create `src/css/main.css` — mobile-first single-column layout (≥320 px); wider centred layout (≥1024 px); fluid no-overflow at all widths 320–1024 px; recovery screen styled distinctly (warning colours, centred, visible buttons); entry row layout (weight + timestamp on left, delete button on right); legible font sizes; accessible focus ring on all interactive elements; export controls grouped visually
- [ ] T015 [P] Write failing tests for corrupt-data recovery screen in `tests/ui.test.ts` (FR-013 block): given `isDataCorrupt()` returns true on startup, `renderApp()` shows `#recovery-screen` and hides `#app`; clicking "Download raw data" calls `getRawStorageString()` and triggers a file download named `weight-data-raw.txt`; clicking "Reset" calls `localStorage.clear()` and reloads the page; given `isDataCorrupt()` returns false, `renderApp()` shows `#app` and hides `#recovery-screen`
- [ ] T016 Implement corrupt-data recovery logic — add `renderRecoveryScreen(): void` to `src/ts/ui.ts`: populates `#recovery-screen` with explanation text, a "Download raw data" `<button>` and a "Reset" `<button>`; "Download raw data" creates a `Blob` from `getRawStorageString()` and triggers anchor download as `weight-data-raw.txt`; "Reset" calls `localStorage.clear()` then `location.reload()`; add `renderApp(corrupt: boolean): void` that shows/hides `#recovery-screen` vs `#app` accordingly (depends on T015 failing)

**Checkpoint**: Foundation ready — run `npm test` — all T008, T010, T015 tests must pass.
User story work can begin.

---

## Phase 3: User Story 1 — Log a Weight Entry (Priority: P1) 🎯 MVP

**Goal**: A user can enter a weight value, submit it, and immediately see it in the history
list. The entry persists after a page refresh.

**Independent Test**: Run quickstart.md Checkpoint 1 (all 5 steps).

> **NOTE: Write T017 FIRST — confirm it FAILS — then implement T018 and T019**

- [ ] T017 [US1] Write failing tests for entry submission in `tests/ui.test.ts` (US1 block): valid input creates entry prepended to list; empty input shows error, no entry created; out-of-range input shows error; after successful submit weight input is cleared; after successful submit no error message shown; Enter key in `#weight-input` triggers submit
- [ ] T018 [US1] Implement entry form logic in `src/ts/ui.ts` — `renderEntry(entry: WeightEntry): HTMLElement` builds one row (weight + stored unit, formatted date/time, delete button with `data-id` AND `data-action="delete"`); `renderEntryList(entries: WeightEntry[]): void` clears `#entry-list`, renders all entries or empty-state message ("No entries yet — log your first weight above."); `showError(msg: string): void` and `clearError(): void` toggle `#error-msg`; `handleSubmit(event: Event): void` — reads `#weight-input`, calls `validateWeight`, calls `createEntry`, prepends to in-memory array, calls `saveEntries`, calls `renderEntryList`, clears form (depends on T017 failing)
- [ ] T019 [US1] Implement `src/ts/main.ts` — on `DOMContentLoaded`: call `loadEntries()` then `renderApp(isDataCorrupt())`; if not corrupt: call `loadPreferences()`, set `#unit-select` value, call `renderEntryList()`; wire `#unit-select` change → `setUnit()` + re-render unit labels; wire `#submit-btn` click and `#weight-input` keydown(Enter) → `handleSubmit()`; wire `#entry-list` click delegation for `data-action="delete"` → delete stub (console.log; replaced in US3); wire recovery screen buttons (calls `renderRecoveryScreen()`)

**Checkpoint**: US1 complete — run quickstart.md Checkpoint 1. All 5 steps must pass.
The MVP is now deliverable.

---

## Phase 4: User Story 2 — View Entry History (Priority: P2)

**Goal**: All previously logged entries are displayed newest-first, each with weight, unit,
and timestamp. Empty-state message shown when no entries exist.

**Independent Test**: Run quickstart.md Checkpoint 2 (all 3 steps).

> **NOTE: Write T020 FIRST — confirm it FAILS — then implement T021**

- [ ] T020 [P] [US2] Write failing tests for history rendering in `tests/ui.test.ts` (US2 block): 3 entries with distinct timestamps render in newest-first order; each row shows weight value, stored unit label, and human-readable local date and time; empty array renders empty-state message and no entry rows; new entry prepended to non-empty list maintains newest-first order; entries with different stored units (kg vs lbs) each display their own unit label
- [ ] T021 [US2] Update `renderEntry()` in `src/ts/ui.ts` to format `timestamp` as human-readable local date (e.g. "13 Mar 2026") and local time (e.g. "09:15") using `Intl.DateTimeFormat`; confirm `renderEntryList()` correctly shows empty-state vs entries; verify stored unit label per entry (not global pref) is displayed (depends on T020 failing)
- [ ] T022 [US2] Manual checkpoint: run quickstart.md Checkpoint 4 (unit preference) — log entry in kg, switch to lbs, confirm existing entry still shows "kg" label; log new entry, confirm it shows "lbs"; reload, confirm unit preference persists

**Checkpoint**: US2 complete — run quickstart.md Checkpoint 2. All 3 steps must pass.

---

## Phase 5: User Story 4 — Export Entries (Priority: P2)

**Goal**: A user can download all entries as a CSV or JSON file. The file is generated
entirely client-side. Empty export produces an empty-but-valid file, not an error.

**Independent Test**: Activate export with entries present; confirm correct file downloads
for each format with correct filename (weight-entries-YYYY-MM-DD.{csv,json}).

> **NOTE: Write T023 FIRST — confirm it FAILS — then implement T024–T026**

- [ ] T023 [P] [US4] Write failing tests for export in `tests/export.test.ts` (US4 block): `generateCSV([])` returns header row only (`date,time,weight,unit\n`); `generateCSV([entry])` returns header + one data row with correct values; `generateJSON([])` returns `"[]"`; `generateJSON([entry])` returns stringified array matching storage schema; `formatExportFilename("csv")` returns `"weight-entries-YYYY-MM-DD.csv"` with today's date; `formatExportFilename("json")` returns matching `.json` filename; entries with different stored units are preserved correctly in both formats
- [ ] T024 [US4] Implement `src/ts/export.ts` — `generateCSV(entries: WeightEntry[]): string` (header: `date,time,weight,unit`; each row: ISO date portion, time portion, weightValue, unit; values comma-separated, no quotes needed for these field types); `generateJSON(entries: WeightEntry[]): string` (JSON.stringify of the full entries array); `formatExportFilename(format: "csv" | "json"): string` (returns `weight-entries-YYYY-MM-DD.csv` or `.json` using today's local date); `triggerDownload(content: string, filename: string, mimeType: string): void` (creates Blob → object URL → hidden anchor click → revoke URL) (depends on T023 failing)
- [ ] T025 [US4] Wire export controls in `src/ts/main.ts` — on `#export-btn` click: read `#export-format` value (`"csv"` or `"json"`); call `generateCSV` or `generateJSON` with current entries; call `triggerDownload` with correct MIME type (`text/csv` or `application/json`) and filename from `formatExportFilename`
- [ ] T026 [US4] Add `src/ts/export.ts` module to `tsconfig.json` include paths if not already inferred; verify Vite picks up the new module in production build by running `npm run build` and confirming no build errors

**Checkpoint**: US4 complete — with entries logged, click export CSV and export JSON;
confirm both files download with correct names, formats, and all entry data present.

---

## Phase 6: User Story 3 — Delete an Entry (Priority: P3)

**Goal**: A user can delete any individual entry with confirmation. Deletion persists after
a page refresh.

**Independent Test**: Run quickstart.md Checkpoint 3 (all 4 steps).

> **NOTE: Write T027 FIRST — confirm it FAILS — then implement T028**

- [ ] T027 [P] [US3] Write failing tests for delete flow in `tests/ui.test.ts` (US3 block): clicking `[data-action="delete"]` with confirmed `confirm()` removes that entry from the rendered list and from `saveEntries` call; cancelling `confirm()` leaves entry unchanged in list and storage; deleting last entry shows empty-state message; `data-id` on delete button matches the entry's `id` field
- [ ] T028 [US3] Implement delete handler in `src/ts/ui.ts` — replace the console.log stub from T019: on click of element with `data-action="delete"`, extract `data-id`, call `window.confirm()` for confirmation; if confirmed: filter entry from in-memory array, call `saveEntries()`, call `renderEntryList()`; if cancelled: no-op (depends on T027 failing)
- [ ] T029 [US3] Update click-delegation handler in `src/ts/main.ts` to correctly target `data-action === "delete"` on the `#entry-list` and route to the full delete handler from T028 (replacing the console.log stub wired in T019)

**Checkpoint**: US3 complete — run quickstart.md Checkpoint 3. All 4 steps must pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility validation, responsive checks, Docker deployment, final quality gate.

- [ ] T030 [P] Validate keyboard accessibility (FR-012) — manually verify: Tab order moves logically through unit selector → weight input → submit button → export format → export button; Enter in `#weight-input` submits form; each delete button is Tab-reachable and activatable via Space/Enter; recovery screen buttons are keyboard-accessible; adjust `src/index.html` and `src/css/main.css` if any control is unreachable
- [ ] T031 [P] Validate responsive layout (FR-008) — open Chrome DevTools Device Toolbar: verify no horizontal scroll at 320 px, 375 px, 768 px, and 1280 px; adjust `src/css/main.css` if any breakpoint fails
- [ ] T032 Verify Docker deployment — `docker build -t weight-tracker . && docker run --rm -p 8080:80 weight-tracker`; open `http://localhost:8080`; confirm all 4 user stories work end-to-end; confirm zero outbound network requests in DevTools → Network during normal use
- [ ] T033 [P] Run full test suite: `npm test` — all tests in model.test.ts, storage.test.ts, ui.test.ts, export.test.ts MUST pass; fix any remaining failures
- [ ] T034 [P] Final review — confirm: no `console.log` stubs remain; FR-002 unit label behavior correct (stored unit per entry); localStorage keys are `weight_tracker_entries` and `weight_tracker_preferences`; export filename matches `weight-entries-YYYY-MM-DD.{csv,json}` pattern; recovery screen only appears on actual corrupt data; `data-action="delete"` present on all delete buttons

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002–T007 parallel after T001
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all stories
  - TDD order: T008→T009; T010→T011; T015→T016
  - T012, T013, T014 parallel once Phase 1 done
- **US1 (Phase 3)**: Depends on Phase 2 — T017→T018→T019
- **US2 (Phase 4)**: Depends on Phase 3 checkpoint — T020→T021; T022 manual
- **US4 (Phase 5)**: Depends on Phase 4 checkpoint — T023→T024→T025→T026
- **US3 (Phase 6)**: Depends on Phase 5 checkpoint (or Phase 3 minimum) — T027→T028→T029
- **Polish (Phase 7)**: Depends on all story phases

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2. No dependency on US2/US3/US4.
- **US2 (P2)**: Depends on US1 (rendering module). History display builds on US1's `ui.ts`.
- **US4 (P2)**: Depends on US2 (entries in list to export). Same priority as US2; sequenced after.
- **US3 (P3)**: Depends on US1 (delete button in `ui.ts`). Could start after Phase 3 but sequenced after US4.

### Within Each Phase

- TDD: test task MUST precede implementation task
- All [P]-marked tasks within a phase can run in parallel

---

## Parallel Opportunities

```bash
# Phase 1 (after T001):
T002 || T003 || T004 || T005 || T006 || T007

# Phase 2 (after Phase 1):
T008 [→T009] || T010 [→T011] || T015 [→T016]
T012 || T013 || T014   ← parallel once Phase 1 done

# Phase 4:
T020 [→T021] || T022 can run any time after Phase 3

# Phase 5:
T023 [→T024→T025→T026]

# Phase 6:
T027 [→T028→T029]

# Phase 7:
T030 || T031 || T033 || T034   ← all parallel; T032 sequential (docker build)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational — includes FR-013 recovery screen)
3. Complete Phase 3 (US1 — log entry)
4. **STOP and VALIDATE** via quickstart.md Checkpoint 1
5. Deploy/demo the MVP

### Incremental Delivery

| Step | Deliverable | Validated by |
|------|-------------|--------------|
| After Phase 3 | Log entry + persist + recovery screen | Quickstart Checkpoint 1 |
| After Phase 4 | Full history view | Quickstart Checkpoint 2 |
| After Phase 5 | CSV/JSON export | US4 export checkpoint |
| After Phase 6 | Delete with confirm | Quickstart Checkpoint 3 |
| After Phase 7 | Accessible + responsive + Docker | Quickstart Checkpoints 4–6 |

---

## Notes

- `[P]` = different files, no shared incomplete dependencies — safe to run concurrently
- `[Story]` label maps task to user story for traceability
- TDD is NON-NEGOTIABLE per constitution Principle III — never skip the failing-test step
- Each story checkpoint MUST pass before the next story begins
- localStorage keys use `weight_tracker_` prefix (storage-contract.md)
- FR-013 recovery screen is in Phase 2 (Foundational) because corrupt-data detection
  is a startup precondition — every user story depends on the app loading correctly
- `export.ts` is a separate module (not folded into `ui.ts`) because export logic is
  independently testable pure functions with no DOM dependency
