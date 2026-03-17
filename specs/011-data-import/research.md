# Research: Weight Data Import (011-data-import)

## 1. CSV Parsing Approach

**Decision**: Use manual line-by-line string splitting (no external library)

**Rationale**: The CSV format required is minimal (two or three columns: date, weight, optional unit). .NET's `string.Split(',')` with trim handling is sufficient and introduces zero new dependencies. The spec YAGNI principle (Constitution §V) prohibits pulling in a CSV library when none is needed.

**Alternatives considered**:
- `CsvHelper` NuGet package — rejected: adds a dependency for a trivially simple format
- `TextFieldParser` (Microsoft.VisualBasic) — rejected: unusual namespace for a C# project

**Header detection**: If the first row's second column cannot be parsed as a number, it is treated as a header row and skipped without counting as an error (FR-010).

---

## 2. Unit Handling in CSV

**Decision**: Accept an optional third column for unit (`kg` or `lbs`). If absent, fall back to the user's stored `PreferredUnit` from ChartSettings.

**Rationale**: The spec requires "at minimum" date + weight. WeightEntry entities require a unit. The user's preferred unit is already stored and is the most natural default — a user migrating data from another app is almost certainly using the same unit they configured. The optional third column allows power users to supply explicit units per row.

**Alternatives considered**:
- Require a unit query parameter on the endpoint — rejected: extra friction for simple imports; most users have a consistent unit
- Always require third column — rejected: breaks the "at minimum two columns" spec requirement and increases file preparation burden

---

## 3. Duplicate Detection Strategy

**Decision**: Add `GetExistingDatesAsync(Guid userId)` to `IWeightEntryRepository`, returning `HashSet<DateOnly>`. Check against this set before inserting each row.

**Rationale**: The existing `AddAsync` duplicate check uses GUID identity — not useful for CSV rows which have no ID. Fetching all existing dates once at import start avoids N round-trips to the database (one per row). For a personal-use import of a few hundred to a few thousand rows, a single bulk fetch is the correct trade-off.

**Alternatives considered**:
- Query DB per row inside the loop — rejected: O(n) queries on what could be thousands of rows
- Reuse `AddAsync` with a synthetic GUID from date hash — rejected: obscures intent, fragile
- Add a unique date index to WeightEntries table — rejected: not in scope (would break existing behavior for same-day re-weigh scenarios); date uniqueness is an import-only concern

**Date granularity**: Duplicate check uses `DateOnly` (calendar date), ignoring time-of-day component. The import normalizes all row dates to midnight UTC for storage.

---

## 4. Endpoint Design: New vs. Extend

**Decision**: New endpoint `POST /api/import` in a new `ImportEndpoints.cs` file.

**Rationale**: The existing `/api/migrate` endpoint accepts JSON, not multipart/form-data. Extending it would require mixing two content types in one endpoint handler. A separate endpoint follows the single-responsibility principle and matches the existing per-concern endpoint file pattern (`EntryEndpoints.cs`, `MigrationEndpoints.cs`, `AuthEndpoints.cs`, etc.).

**Alternatives considered**:
- Extend `/api/migrate` — rejected: would conflate localStorage migration (JSON) with file import (multipart)
- Reuse `/api/entries` with a new verb — rejected: that endpoint is for individual entries, not bulk file upload

---

## 5. File Size Limit

**Decision**: Enforce a 5 MB limit in the endpoint handler (matching spec assumption).

**Rationale**: A year of daily entries at ~20 bytes per row ≈ 7 KB. 5 MB allows ~250 years of daily data, which is more than sufficient while preventing abuse. ASP.NET Core's default `MaxRequestBodySize` (30 MB) is higher than needed; we enforce the limit explicitly in the handler by checking `file.Length`.

---

## 6. Frontend File Upload Pattern

**Decision**: Add a new `importCsvFile(file: File)` function to `api-client.ts` using `FormData` + `fetch` with a `multipart/form-data` content type. Do NOT set `Content-Type` manually (browser sets the correct boundary automatically).

**Rationale**: Follows the existing `api-client.ts` pattern with Bearer token injection and 401-refresh logic. `FormData` is a standard browser API available in ES2020 with no polyfills needed.

---

## 7. Response Format

**Decision**: Mirror the `/api/migrate` response shape, extended with per-row error detail:

```json
{
  "importedCount": 47,
  "skippedDuplicateCount": 3,
  "failedCount": 2,
  "errors": [
    { "row": 5, "reason": "weight value is not a valid number" },
    { "row": 12, "reason": "date format is not recognized" }
  ]
}
```

**Rationale**: Consistent with existing migration response pattern. Separates "skipped as duplicate" from "failed validation" per FR-006, which the existing migration endpoint does not distinguish.

---

## 8. Test Strategy

**Decision**: Integration tests in `WeightTracker.Tests/Integration/Endpoints/ImportEndpointsTests.cs` using the existing `ApiFixture` and `WebApplicationFactory`. Tests post actual `MultipartFormDataContent` with CSV content strings (no disk files needed).

**Rationale**: All existing integration tests follow this pattern. No unit tests for the CSV parser are needed until the parser is non-trivially complex — a simple splitter can be tested via the integration tests.
