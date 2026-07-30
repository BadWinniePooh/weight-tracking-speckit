# Quickstart: Weight Data Import (011-data-import)

## What This Feature Adds

A CSV file import flow that lets users migrate historical weight data from other apps into their account. Accessible from the Profile page — no new pages.

---

## CSV File Format

Create a `.csv` file with one row per weight entry:

```csv
date,weight
2024-01-01,75.5
2024-01-08,75.1
2024-01-15,74.8
```

- **date**: Required. Format must be `YYYY-MM-DD`.
- **weight**: Required. Positive number. In your account's preferred unit (kg or lbs) unless you add a third column.
- **unit** (optional third column): `kg` or `lbs`. If omitted, your account's preferred unit is used.

---

## How to Import

1. Log in and navigate to **Profile**.
2. Scroll to the **Import Data** section.
3. Click **Choose File** and select your `.csv` file.
4. Click **Import**.
5. Review the summary — it shows how many entries were imported, how many were skipped (duplicates), and details for any invalid rows.

---

## Duplicate Handling

If an entry already exists for a given date in your account, the import row for that date is silently skipped. Your existing entry is not changed. Re-importing the same file is safe.

---

## Error Report

If some rows fail, you will see a table like:

| Row | Error |
|-----|-------|
| 5   | weight value is not a valid number |
| 12  | date format is not recognized; expected YYYY-MM-DD |

Fix the identified rows in your file and re-upload. Valid rows from the first import are already saved and will be skipped as duplicates on re-upload.

---

## File Limits

- Format: CSV only (`.csv`)
- Maximum size: 5 MB (~250,000+ daily entries)
- Encoding: UTF-8

---

## Developer Notes

### New backend files

- `backend/WeightTracker.Api/Endpoints/ImportEndpoints.cs` — `POST /api/import`
- `backend/WeightTracker.Tests/Integration/Endpoints/ImportEndpointsTests.cs`

### Changed backend files

- `backend/WeightTracker.Domain/Interfaces/Repositories/IWeightEntryRepository.cs` — adds `GetExistingDatesAsync`
- `backend/WeightTracker.Infrastructure/Repositories/WeightEntryRepository.cs` — implements `GetExistingDatesAsync`
- `backend/WeightTracker.Api/Program.cs` — registers `app.MapImportEndpoints()`

### New frontend files

- `frontend/src/ts/import.ts` — `importCsvFile()` API call + UI wire-up for profile page import section

### Changed frontend files

- `frontend/src/ts/api-client.ts` — adds `importCsvFile(file: File): Promise<ImportResult>`
- `frontend/src/profile.html` — adds "Import Data" section
