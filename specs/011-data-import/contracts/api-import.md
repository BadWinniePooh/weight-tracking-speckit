# API Contract: POST /api/import

## Overview

Accepts a CSV file upload, parses and validates each row, bulk-inserts valid entries for the authenticated user, and returns a summary of the import result.

---

## Request

**Method**: `POST`
**Path**: `/api/import`
**Authentication**: Bearer JWT token required (`Authorization: Bearer <token>`)
**Content-Type**: `multipart/form-data`

### Form Fields

| Field  | Type | Required | Description                        |
|--------|------|----------|------------------------------------|
| `file` | file | Yes      | CSV file to import (max 5 MB)      |

### Accepted File Type

- MIME type: `text/csv` or `application/octet-stream`
- File extension: `.csv`
- Encoding: UTF-8

---

## Response

### 200 OK — Import processed (partial success is also 200)

```json
{
  "importedCount": 47,
  "failedCount": 2,
  "errors": [
    { "row": 5, "reason": "weight value is not a valid number" },
    { "row": 12, "reason": "date format is not recognized; expected YYYY-MM-DD" }
  ]
}
```

| Field           | Type    | Description                                          |
|-----------------|---------|------------------------------------------------------|
| `importedCount` | integer | Count of rows successfully inserted                  |
| `failedCount`   | integer | Count of rows that failed validation                 |
| `errors`        | array   | Per-row error details; empty array if no failures    |
| `errors[].row`  | integer | 1-based row number in the uploaded file              |
| `errors[].reason`| string | Human-readable description of the validation failure |

**Note**: A 200 response does NOT mean all rows succeeded. Check `failedCount` and `errors`.

### 400 Bad Request — File or format problem

```json
{ "error": "No file uploaded" }
```

```json
{ "error": "File must be a CSV (.csv)" }
```

```json
{ "error": "File size exceeds 5 MB limit" }
```

```json
{ "error": "File is empty or contains no data rows" }
```

### 401 Unauthorized — Missing or invalid token

```json
{ "error": "Unauthorized" }
```

---

## Validation Rules (per row)

| Rule          | Invalid condition                              | Error message                                        |
|---------------|------------------------------------------------|------------------------------------------------------|
| Date present  | Column 1 is empty or whitespace               | "date is missing"                                    |
| Date format   | Cannot be parsed as `YYYY-MM-DD`              | "date format is not recognized; expected YYYY-MM-DD" |
| Weight present| Column 2 is empty or whitespace               | "weight value is missing"                            |
| Weight numeric| Column 2 cannot be parsed as a decimal number | "weight value is not a valid number"                 |
| Weight > 0    | Parsed weight ≤ 0                             | "weight value must be greater than zero"             |
| Weight range (kg) | > 635                                     | "weight value out of range for kg (max 635)"         |
| Weight range (lbs) | > 1400                                   | "weight value out of range for lbs (max 1400)"       |
| Unit (if col 3 present) | Not `kg` or `lbs`               | "unit must be 'kg' or 'lbs'"                         |

---

## Behaviour Details

1. **Header row detection**: If row 1's weight column is non-numeric, it is silently skipped as a header row. It does NOT appear in `errors`.
2. **No duplicate detection**: All valid rows are inserted regardless of whether a matching date already exists. Multiple entries per date are permitted.
3. **Unit fallback**: If column 3 is absent, the user's `PreferredUnit` from `ChartSettings` is used. If no `ChartSettings` exist, defaults to `kg`.
4. **Timestamp normalization**: Dates are stored as midnight UTC (`YYYY-MM-DDT00:00:00Z`).
5. **Bulk insert**: All valid rows are inserted in a single database operation.
6. **Extra columns**: Columns 4+ are silently ignored.

---

## Example cURL

```bash
curl -X POST https://your-host/api/import \
  -H "Authorization: Bearer <token>" \
  -F "file=@weight-history.csv"
```

---

## Frontend TypeScript Signature

```typescript
export interface ImportResult {
  importedCount: number;
  failedCount: number;
  errors: Array<{ row: number; reason: string }>;
}

export async function importCsvFile(file: File): Promise<ImportResult>
```
