# Data Model: Weight Data Import (011-data-import)

## Existing Entities (unchanged)

### WeightEntry (WeightTracker.Domain.Entities.WeightEntry)

No schema changes. CSV import creates new `WeightEntry` rows using the existing entity.

| Field        | Type       | Constraints                        | Notes                                    |
|--------------|------------|------------------------------------|------------------------------------------|
| `Id`         | `Guid`     | PK                                 | Generated fresh (`Guid.NewGuid()`)       |
| `UserId`     | `Guid`     | FK → Users.Id, NOT NULL            | Set from authenticated user JWT claim    |
| `WeightValue`| `decimal`  | decimal(10,4), range per unit      | kg: 0–635; lbs: 0–1400                   |
| `Unit`       | `string`   | CHECK IN ('kg','lbs'), NOT NULL    | From CSV col 3 or user's PreferredUnit   |
| `Timestamp`  | `DateTime` | NOT NULL, index (UserId, Timestamp DESC) | Normalized to midnight UTC from parsed date |
| `CreatedAt`  | `DateTime` | NOT NULL                           | Set to `DateTime.UtcNow` at import time  |

**No duplicate detection**: All valid rows are inserted. Multiple entries for the same date are permitted.

---

## New Domain Interface Method

### IWeightEntryRepository — new method

```
AddRangeAsync(entries: IEnumerable<WeightEntry>) → int
```

Inserts all entries in a single database operation and returns the count of rows inserted. Used by the import endpoint to bulk-insert all valid rows with a single SaveChanges call.

---

## New API Types (record types local to ImportEndpoints.cs)

### ImportRowError

Represents a single row-level validation failure in the import result.

| Field    | Type     | Description                               |
|----------|----------|-------------------------------------------|
| `Row`    | `int`    | 1-based row number from the uploaded file |
| `Reason` | `string` | Human-readable description of the error  |

### ImportResult (HTTP response shape)

Returned by `POST /api/import` on success (HTTP 200).

| Field                  | Type                  | Description                                      |
|------------------------|-----------------------|--------------------------------------------------|
| `importedCount`        | `int`                 | Number of rows successfully inserted             |
| `skippedDuplicateCount`| `int`                 | Rows skipped because date already exists         |
| `failedCount`          | `int`                 | Rows rejected due to validation errors           |
| `errors`               | `List<ImportRowError>`| Detail for each failed row (empty if none)       |

---

## CSV Format Specification

### Required columns (minimum)

| Column | Position | Type   | Description                          |
|--------|----------|--------|--------------------------------------|
| `date` | 1        | string | Calendar date of the weight entry    |
| `weight`| 2       | string | Numeric weight value                 |

### Optional column

| Column | Position | Type   | Description                                    |
|--------|----------|--------|------------------------------------------------|
| `unit` | 3        | string | `kg` or `lbs`; defaults to user's PreferredUnit|

### Date format

- **Required**: `YYYY-MM-DD` (ISO 8601)
- Best-effort attempt: `MM/DD/YYYY` and `DD/MM/YYYY` are NOT attempted — rows with non-ISO dates fail with a clear error directing the user to use `YYYY-MM-DD` format.

### Header row

- If row 1 has a non-numeric value in column 2, it is silently treated as a header and skipped.

### Extra columns

- Columns beyond position 3 are silently ignored.

### Example (minimal valid file)

```csv
date,weight
2024-01-01,75.5
2024-01-08,75.1
2024-01-15,74.8
```

### Example (with explicit unit)

```csv
date,weight,unit
2024-01-01,165.0,lbs
2024-01-08,164.3,lbs
```

---

## No Schema Migrations Required

This feature adds no new database tables or columns. The only repository change is a new read method on the existing `WeightEntries` table.
