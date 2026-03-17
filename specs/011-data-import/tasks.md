# Tasks: Weight Data Import

**Input**: Design documents from `/specs/011-data-import/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Note on scope change**: Duplicate detection removed per implementation decision. All valid CSV rows are imported as-is. No `skippedDuplicateCount` field, no `GetExistingDatesAsync`, no per-date uniqueness check.

**TDD**: Tests written first for all backend logic per constitution §III (NON-NEGOTIABLE).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the endpoint skeleton and wire it into the application so subsequent tasks have a compile-clean base to build on.

- [x] T001 Create `backend/WeightTracker.Api/Endpoints/ImportEndpoints.cs` with a `MapImportEndpoints()` extension method stub (returns `Results.StatusCode(501)`) and register `app.MapImportEndpoints()` in `backend/WeightTracker.Api/Program.cs` after `app.MapMigrationEndpoints()`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add bulk-insert capability to the repository so the endpoint can insert all valid rows in a single database operation.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [x] T002 Add `Task<int> AddRangeAsync(IEnumerable<WeightEntry> entries)` to `backend/WeightTracker.Domain/Interfaces/Repositories/IWeightEntryRepository.cs` (returns count of rows inserted)
- [x] T003 Implement `AddRangeAsync` in `backend/WeightTracker.Infrastructure/Repositories/WeightEntryRepository.cs` using `db.WeightEntries.AddRange(entries)` followed by a single `db.SaveChangesAsync()` — return the count of entries passed in

**Checkpoint**: `dotnet build` passes with no errors. Foundation ready. ✅

---

## Phase 3: User Story 1 — Successful CSV Import (Priority: P1) 🎯 MVP

**Goal**: Authenticated user uploads a valid CSV file from the profile page; all data rows are inserted into their account and the response reports how many entries were imported.

**Independent Test**: Upload a well-formed 3-row CSV (with and without a header row) via the integration test client; assert HTTP 200 and `importedCount` equals the number of data rows; query the repository and assert the entries are present for the test user.

### Tests for User Story 1 — Write FIRST, ensure they FAIL before implementing

> **⚠️ Write these tests before any implementation. Confirm each fails for the right reason.**

- [x] T004 [US1] Write failing integration tests for the happy path in `backend/WeightTracker.Tests/Integration/Endpoints/ImportEndpointsTests.cs`:
  - POST with valid 3-row CSV (no header) → HTTP 200, `importedCount: 3`
  - POST with valid 3-row CSV + header row → HTTP 200, `importedCount: 3` (header silently skipped)
  - POST with no file attached → HTTP 400, `error: "No file uploaded"`
  - POST with a non-CSV file (e.g., `.txt` with wrong extension) → HTTP 400
  - POST without auth token → HTTP 401
  - POST with file exceeding 5 MB → HTTP 400
  - Follow the existing `ApiFixture` pattern; post CSV content as `MultipartFormDataContent` with field name `file`

### Implementation for User Story 1

- [x] T005 [US1] In `ImportEndpoints.cs`, replace the 501 stub with a handler that: (1) reads `IFormFile file` from the multipart form, (2) rejects missing/non-.csv files and files > 5 MB with 400 responses, (3) reads all lines from the file stream
- [x] T006 [US1] In `ImportEndpoints.cs`, implement `ParseCsvRows(IEnumerable<string> lines)`: split each line on comma, trim whitespace, detect header (first row's column-2 is non-numeric → skip silently), return a list of raw row structs `{ RowNumber, RawDate, RawWeight, RawUnit? }`
- [x] T007 [US1] In `ImportEndpoints.cs`, implement row-to-entity conversion: parse `RawDate` with `DateOnly.ParseExact(YYYY-MM-DD)`, parse `RawWeight` as `decimal`, resolve unit (column 3 if present and valid, else `preferredUnit` from `IChartSettingsRepository.GetByUserIdAsync()`, else `"kg"`), create `WeightEntry { Id = Guid.NewGuid(), UserId, WeightValue, Unit, Timestamp = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), CreatedAt = DateTime.UtcNow }`
- [x] T008 [US1] In `ImportEndpoints.cs`, call `entryRepository.AddRangeAsync(validEntries)` and return `Results.Ok(new { importedCount })` — confirm T004 tests pass

**Checkpoint**: All T004 tests pass. ✅

---

## Phase 4: User Story 2 — Partial Import with Error Reporting (Priority: P2)

**Goal**: When a CSV contains a mix of valid and invalid rows, valid rows are still inserted and the response includes a per-row error list (row number + reason) for every row that failed validation, plus a `failedCount`.

**Independent Test**: Upload a CSV where rows 2 and 4 are malformed; assert `importedCount` equals the valid row count, `failedCount: 2`, and `errors` contains entries for rows 2 and 4 with specific reason strings.

### Tests for User Story 2 — Write FIRST, ensure they FAIL before implementing

> **⚠️ Write these tests before any implementation. Confirm each fails for the right reason.**

- [x] T009 [US2] Add failing integration tests to `backend/WeightTracker.Tests/Integration/Endpoints/ImportEndpointsTests.cs`:
  - CSV with 2 valid rows + 1 row with non-numeric weight → HTTP 200, `importedCount: 2`, `failedCount: 1`, `errors[0].row` = that row number, `errors[0].reason` contains "not a valid number"
  - CSV with 1 valid row + 1 row with bad date format → HTTP 200, `importedCount: 1`, `failedCount: 1`, `errors[0].reason` contains "YYYY-MM-DD"
  - CSV with 1 valid row + 1 row with missing weight → HTTP 200, `importedCount: 1`, `failedCount: 1`
  - CSV where all rows are invalid → HTTP 200, `importedCount: 0`, `failedCount: N`, `errors` has N entries
  - CSV with row having weight ≤ 0 → error reason contains "greater than zero"
  - CSV with row having kg weight > 635 → error reason contains "out of range"

### Implementation for User Story 2

- [x] T010 [US2] In `ImportEndpoints.cs`, extend the row validation step to collect `List<ImportRowError> { Row, Reason }` for each invalid row (missing date, unparseable date, missing weight, non-numeric weight, weight ≤ 0, weight out of range, invalid explicit unit) — invalid rows are skipped from the insert list but never abort the loop
- [x] T011 [US2] In `ImportEndpoints.cs`, update the response to `Results.Ok(new { importedCount, failedCount = errors.Count, errors })` and define a local `record ImportRowError(int Row, string Reason)` — confirm T009 tests pass

**Checkpoint**: All 12 import tests pass (168 total). ✅

---

## Phase 5: Frontend

**Goal**: Add an "Import Data" section to the profile page that lets the user pick a CSV file, submit it, and see the result (imported count, failed rows with reasons).

**Independent Test**: Navigate to `/profile.html`, use the Import Data section to upload a CSV, verify the success/error summary renders correctly.

- [x] T012 [P] Add `ImportResult` interface and `importCsvFile(file: File): Promise<ImportResult>` function to `frontend/src/ts/api-client.ts`:
  ```typescript
  export interface ImportResult {
    importedCount: number;
    failedCount: number;
    errors: Array<{ row: number; reason: string }>;
  }
  // Uses FormData + fetch with Bearer token; follows existing request() pattern
  ```
- [x] T013 [P] Create `frontend/src/ts/import.ts`:
  - Export `initImport()` function
  - On submit: disable button, call `importCsvFile(file)`, re-enable button
  - On success: show "X entries imported" message; if `failedCount > 0` render a DaisyUI table listing each `errors[].row` and `errors[].reason`
  - On error: show generic error message using existing `ui.ts` error patterns
- [x] T014 Add "Import Data" section to `frontend/src/profile.html` below the existing Change Password section:
  - `<section>` with DaisyUI card styling consistent with surrounding sections
  - `<input type="file" accept=".csv">` and a "Import" submit button
  - Empty result `<div>` for dynamic content rendered by `import.ts`
- [x] T015 Import and call `initImport()` from `frontend/src/ts/profile.ts` in the `DOMContentLoaded` handler (alongside existing `changeUsername`, `changePassword`, `changeEmail` wiring)

**Checkpoint**: Profile page import section is functional end-to-end in the browser. ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T016 [P] Update `specs/011-data-import/data-model.md` to remove the `GetExistingDatesAsync` entry and the "Duplicate detection" section; add `AddRangeAsync` method documentation
- [x] T017 [P] Update `specs/011-data-import/contracts/api-import.md` to remove `skippedDuplicateCount` from the response schema and the duplicate-detection behaviour note
- [x] T018 Run `cd backend && dotnet test` — all tests must pass (zero failures) → 168/168 passed ✅
- [x] T019 Run `cd frontend && npm test` — 340/344 pass; 4 pre-existing failures in unrelated reset-* tests (confirmed on baseline) ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — blocks all user story phases
- **US1 (Phase 3)**: Depends on Phase 2 — T004 (tests) before T005–T008 (implementation)
- **US2 (Phase 4)**: Depends on Phase 3 completion — T009 (tests) before T010–T011 (implementation)
- **Frontend (Phase 5)**: Depends on Phase 4 (API contract fully defined) — T012 and T013 are parallel
- **Polish (Phase 6)**: Depends on all implementation phases complete

### Within Each User Story

```
Tests FIRST → fail for the right reason → implement → tests pass
```

### Parallel Opportunities

- T002 and T003 are sequential (interface before implementation)
- T012 (api-client) and T013 (import.ts) can run in parallel (different files)
- T014 (HTML) can run in parallel with T012 and T013
- T016 and T017 (doc updates) can run in parallel
- T018 and T019 (final test runs) are independent

---

## Notes

- TDD is NON-NEGOTIABLE (constitution §III): run tests, confirm failure, then implement
- No new NuGet or npm packages; no EF Core migrations
- `importedCount` only — no `skippedDuplicateCount`
- Unit fallback chain: CSV col 3 → ChartSettings.PreferredUnit → `"kg"`
- Commit after each completed phase per constitution commit cadence rules
