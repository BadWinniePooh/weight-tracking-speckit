# Storage Contract: Minimal Weight Tracker

**Type**: Browser localStorage schema contract
**Version**: 1.0.0
**Date**: 2026-03-13

This contract defines the stable interface between the app's UI logic and its
persistence layer. Any code that reads from or writes to `localStorage` MUST
conform to this schema. Changes to this contract require a data migration strategy.

---

## Keys

### `weight_tracker_entries`

**Purpose**: Stores all weight log entries for the user.

**Value**: JSON array of `WeightEntry` objects.

**WeightEntry schema**:

```typescript
interface WeightEntry {
  id: string;           // UUID v4 — unique, immutable, generated at creation
  weightValue: number;  // Positive number within plausible range for the unit
  unit: "kg" | "lbs";  // Unit at time of recording — immutable after creation
  timestamp: string;    // ISO 8601 UTC datetime string (e.g. "2026-03-13T09:00:00.000Z")
}
```

**Ordering**: The array is persisted in descending timestamp order (newest first).

**Absent key**: Treated as an empty array `[]`. The app MUST NOT throw on a missing key.

**Example value**:

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "weightValue": 82.5,
    "unit": "kg",
    "timestamp": "2026-03-13T09:15:00.000Z"
  }
]
```

---

### `weight_tracker_preferences`

**Purpose**: Stores the user's global display and input unit preference.

**Value**: JSON object matching `UserPreferences`.

**UserPreferences schema**:

```typescript
interface UserPreferences {
  unit: "kg" | "lbs";  // Default: "kg" if key absent
}
```

**Absent key**: MUST default to `{ "unit": "kg" }`. The app MUST NOT throw on a
missing key.

**Example value**:

```json
{ "unit": "lbs" }
```

---

## Error Handling Contract

All writes to `localStorage` MUST be wrapped in `try/catch`. The following errors
MUST be handled:

| Error                   | Condition                     | Required App Behaviour                                   |
|-------------------------|-------------------------------|----------------------------------------------------------|
| `QuotaExceededError`    | Storage quota reached (~5 MB) | Surface user-facing message; do NOT save partial data    |
| `SecurityError`         | Private browsing restriction  | Surface user-facing message; degrade gracefully          |
| `SyntaxError` on parse  | Corrupted stored JSON         | Treat as absent key (return default value); log to console |

---

## Versioning Policy

If the schema of `WeightEntry` or `UserPreferences` changes in a future version:

1. Bump the contract version.
2. Implement a migration function that reads the old schema and writes the new schema
   on first load.
3. Document the migration in the release notes.

No migration is required for v1.0.0 (initial schema).
