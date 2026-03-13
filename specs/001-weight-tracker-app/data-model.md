# Data Model: Minimal Weight Tracker

**Feature**: 001-weight-tracker-app
**Date**: 2026-03-13
**Phase**: 1 — Design

---

## Entities

### WeightEntry

A single immutable record of a weight measurement taken at a specific moment.

| Field        | Type                | Constraints                                   | Notes                                      |
|--------------|---------------------|-----------------------------------------------|--------------------------------------------|
| `id`         | string (UUID v4)    | Required; unique; generated at submission      | `crypto.randomUUID()`                      |
| `weightValue`| number              | Required; > 0; within plausible range (see below) | Stored in the unit active at time of entry |
| `unit`       | `"kg"` \| `"lbs"`  | Required; snapshot of user's preference        | Immutable after creation                   |
| `timestamp`  | string (ISO 8601)   | Required; set from device clock at submission  | e.g. `"2026-03-13T09:15:00.000Z"`          |

**Plausible range**:
- kg: `1` ≤ value ≤ `635`
- lbs: `2` ≤ value ≤ `1400`

**Immutability**: Once created, a `WeightEntry` cannot be modified. The only allowed
operation after creation is deletion.

---

### UserPreferences

Global settings persisted in the browser alongside entries.

| Field  | Type               | Constraints            | Notes                          |
|--------|--------------------|------------------------|--------------------------------|
| `unit` | `"kg"` \| `"lbs"` | Required; defaults to `"kg"` | User can change at any time |

**Note**: Changing the unit preference does NOT convert historical `weightValue` fields.
Existing entries are displayed with their stored `unit` label. The preference affects
only the label shown in the UI and the validation range applied to new submissions.

---

## Persistence Schema (localStorage)

Two keys are written to `localStorage`:

### Key: `weight_tracker_entries`

**Value type**: JSON-serialised array of `WeightEntry` objects, ordered by `timestamp`
descending (newest first).

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "weightValue": 82.5,
    "unit": "kg",
    "timestamp": "2026-03-13T09:15:00.000Z"
  },
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "weightValue": 83.0,
    "unit": "kg",
    "timestamp": "2026-03-12T08:00:00.000Z"
  }
]
```

**Read**: Parse with `JSON.parse()`; return `[]` if key is absent or value is `null`.
**Write**: Serialise full array with `JSON.stringify()`; wrap in `try/catch` for
`QuotaExceededError`.

---

### Key: `weight_tracker_preferences`

**Value type**: JSON-serialised `UserPreferences` object.

```json
{ "unit": "kg" }
```

**Read**: Parse with `JSON.parse()`; return `{ "unit": "kg" }` if key is absent.
**Write**: Serialise with `JSON.stringify()`; wrap in `try/catch`.

---

## Validation Rules

| Rule              | Condition                                           | Error Message                                           |
|-------------------|-----------------------------------------------------|---------------------------------------------------------|
| Required          | `weightValue` is empty or not provided              | "Please enter a weight value."                          |
| Numeric           | `weightValue` is not a valid number                 | "Weight must be a number."                              |
| Positive          | `weightValue` ≤ 0                                   | "Weight must be greater than zero."                     |
| Plausible (kg)    | `weightValue` > 635 when unit is `"kg"`             | "Weight seems too high. Please check your entry."       |
| Plausible (lbs)   | `weightValue` > 1400 when unit is `"lbs"`           | "Weight seems too high. Please check your entry."       |
| Storage available | `localStorage.setItem()` throws `QuotaExceededError`| "Storage is full. Please delete some entries first."    |

---

## State Transitions

```
[Empty form]
    │
    ▼ user enters value + submits
[Validation]
    ├── FAIL → display error message → return to [Empty form]
    └── PASS
         │
         ▼ generate id, capture timestamp
    [WeightEntry created]
         │
         ▼ prepend to entries array, persist to localStorage
    [Entry visible in list]
         │
         ▼ user clicks delete + confirms
    [Entry removed from list and localStorage]
```

---

## In-Scope Data Operations

| Operation            | Description                                              |
|----------------------|----------------------------------------------------------|
| Create entry         | Validate → generate ID + timestamp → prepend to array → persist |
| Read all entries     | Load from localStorage → parse → sort descending by timestamp → render |
| Delete entry         | Filter entry by ID → persist updated array → re-render list |
| Read preferences     | Load from localStorage → parse → return default if absent |
| Write preferences    | Merge change → persist → re-render unit labels           |

## Out-of-Scope (this version)

- Entry editing
- Data export / import
- Cross-device sync
- Entry search or filtering
- Aggregates (averages, trends, charts)
