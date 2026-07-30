# Feature Specification: Weight Data Import

**Feature Branch**: `011-data-import`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Import functionality to allow users to migrate their weight tracking data from other applications. Users should be able to upload a file containing historical weight entries and have them imported into their account. The feature should support at minimum CSV format (date + weight value). The import should validate entries before committing — rejecting malformed rows and reporting errors clearly to the user without aborting the entire import. Valid rows should be imported even if some rows fail. The user should be able to trigger the import from their profile page. No new pages — integrate into the existing profile UI. Backend: a new API endpoint that accepts a file upload, parses it, validates each row, and bulk-inserts valid entries. Duplicate detection: if an entry already exists for a given date, skip it (do not overwrite)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Successful CSV Import (Priority: P1)

A logged-in user navigates to their profile page and finds an "Import Data" section. They select a valid CSV file from their device, submit it, and receive confirmation that their historical weight entries have been added to their account. They can then view the imported entries in their weight history.

**Why this priority**: This is the core value of the feature — getting historical data into the system. Without this working end-to-end, no other story is possible.

**Independent Test**: Can be tested by uploading a well-formed CSV and verifying the entries appear in the user's weight history. Delivers the primary migration use case independently.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the profile page with a valid CSV file containing 50 weight entries, **When** they upload the file, **Then** all 50 entries are added to their account and a success message shows "50 entries imported successfully."
2. **Given** a logged-in user on the profile page, **When** the import completes successfully, **Then** the newly imported entries are immediately visible in the weight history view.
3. **Given** a CSV with a header row followed by data rows, **When** the file is uploaded, **Then** the header row is correctly skipped and only data rows are imported.

---

### User Story 2 - Partial Import with Error Reporting (Priority: P2)

A user uploads a CSV file that contains a mix of valid and invalid rows. The system imports all valid entries and presents the user with a clear summary: how many entries were imported, how many were skipped due to errors, and which specific rows failed and why.

**Why this priority**: This is critical for data migration confidence — users need to know exactly what was and was not imported so they can fix and re-attempt failed rows manually if needed.

**Independent Test**: Can be tested by uploading a CSV with intentionally malformed rows mixed with valid rows. Verifies partial import behavior and error reporting independently.

**Acceptance Scenarios**:

1. **Given** a CSV with 10 valid rows and 3 malformed rows, **When** the user uploads the file, **Then** 10 entries are imported and the user sees a summary indicating "10 imported, 3 failed" along with the row numbers and error reasons for the 3 failures.
2. **Given** a CSV where row 5 has a non-numeric weight value, **When** the file is uploaded, **Then** rows 1–4 and 6+ are imported (if valid), and the error report specifies "Row 5: weight value is not a valid number."
3. **Given** a CSV where row 2 has an unparseable date, **When** the file is uploaded, **Then** the error report specifies "Row 2: date format is not recognized."
4. **Given** a CSV where every row is invalid, **When** the file is uploaded, **Then** no entries are imported and the user sees a complete error report with all row failures; the import does not silently fail.

---

### User Story 3 - Duplicate Detection (Priority: P3)

A user uploads a CSV file that contains entries for dates already present in their weight history. The system skips those entries without overwriting existing data and informs the user how many entries were skipped as duplicates.

**Why this priority**: Prevents accidental data overwriting during re-imports or when migrating from multiple sources. Important for data integrity but less urgent than the primary import flow.

**Independent Test**: Can be tested by importing a file where all or some dates already exist in the account. Verifies no data is overwritten and duplicates are reported.

**Acceptance Scenarios**:

1. **Given** a user has an existing entry for 2025-01-15, **When** they upload a CSV containing an entry for 2025-01-15, **Then** the existing entry is unchanged and the import summary notes "1 entry skipped (duplicate date)."
2. **Given** a CSV with 20 rows where 5 dates already exist, **When** the file is uploaded, **Then** 15 entries are imported, 5 are skipped as duplicates, and the summary clearly distinguishes between imported, skipped-duplicate, and failed-invalid counts.
3. **Given** a CSV where all entries are duplicates, **When** the file is uploaded, **Then** no entries are created and the user sees "0 imported, 20 skipped (duplicate dates)" — the operation completes without error.

---

### Edge Cases

- What happens when the user uploads an empty CSV file (no data rows)?
- What happens when the CSV file is extremely large (e.g., thousands of rows)?
- How does the system handle weight values with varying decimal precision (e.g., "70", "70.5", "70.500")?
- What happens when the CSV has extra columns beyond date and weight?
- How does the system handle date values in different but recognizable formats (e.g., "2025-01-15", "01/15/2025", "January 15, 2025")?
- What happens when the user uploads a non-CSV file (e.g., a PDF or image)?
- What if the file exceeds a reasonable size limit?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The profile page MUST include an "Import Data" section with a file upload control and a submit action.
- **FR-002**: The system MUST accept CSV files where each data row contains at minimum a date and a weight value.
- **FR-003**: The system MUST validate each row independently — a validation failure on one row MUST NOT prevent valid rows from being imported.
- **FR-004**: The system MUST reject rows where the date is missing or cannot be parsed into a valid calendar date.
- **FR-005**: The system MUST reject rows where the weight value is missing, non-numeric, zero, or negative.
- **FR-006**: After processing, the system MUST return a summary to the user containing: count of entries imported, count of entries skipped as duplicates, count of rows that failed validation, and for each failed row: the row number and a human-readable error description.
- **FR-007**: The system MUST skip (not overwrite) any import row whose date already has an entry in the user's weight history.
- **FR-008**: The system MUST reject files that are not CSV format and inform the user of the accepted format.
- **FR-009**: The import operation MUST be scoped to the authenticated user — one user cannot import data into another user's account.
- **FR-010**: The system MUST handle a header row gracefully — if the first row contains non-numeric weight data, it MUST be recognized as a header and skipped without being counted as an error.
- **FR-011**: The system MUST impose a reasonable file size limit and reject uploads that exceed it with a clear error message.

### Key Entities

- **Import File**: A user-supplied file containing historical weight entries; has a format (CSV), a set of rows, and is associated with the authenticated user performing the import.
- **Import Row**: A single line from the import file; has a row number, a date value, and a weight value; can be valid, invalid (with an error reason), or a duplicate.
- **Import Result**: The outcome of processing an import file; contains counts of imported, skipped-duplicate, and failed rows, plus a list of row-level errors.
- **Weight Entry**: An existing domain entity representing a single weight measurement on a given date for a user; the import creates new instances of this entity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can complete a full import of 100 historical entries in under 30 seconds from file selection to confirmation.
- **SC-002**: Users can successfully import a valid CSV file on their first attempt without consulting documentation, as measured by task-completion testing.
- **SC-003**: After import, all valid entries from the uploaded file appear correctly in the user's weight history with no data loss or corruption.
- **SC-004**: When a file contains both valid and invalid rows, the error report identifies every failing row and provides a specific, actionable error message for each.
- **SC-005**: No existing weight entry is modified or deleted as a result of an import operation.
- **SC-006**: Uploading the same file twice results in the same final state as uploading it once — the second import produces 0 new entries and reports all rows as duplicates.

## Assumptions

- The CSV format uses comma as the delimiter and supports an optional single header row.
- Dates must be in ISO 8601 format (`YYYY-MM-DD`) as the required format; other formats may be attempted as a best-effort but are not guaranteed.
- Weight values are in the user's configured unit (kg or lbs) — no unit conversion is performed during import.
- File size limit is set to 5 MB, sufficient for several years of daily entries.
- The import is append-only; there is no "replace all" or "overwrite" mode.
- Users are already authenticated via the existing session mechanism; no additional auth step is required for import.
- Extra CSV columns beyond date and weight are silently ignored.
