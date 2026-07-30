# Data Model: Backend API Migration (003)

**Date**: 2026-03-14

---

## Entity Relationships

```
User ──< WeightEntry   (one user → many entries)
User ──1 ChartSettings (one user → one settings record)
```

---

## User

Represents an account that owns weight data. In this iteration, a single default user is seeded at startup. No credentials are stored — the entity exists solely to anchor foreign keys and enable spec 004 to introduce auth without schema changes.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `Id` | UUID | PK, not null | Deterministic seed value: `00000000-0000-0000-0000-000000000001` |
| `DisplayName` | varchar(100) | not null | Seed value: `"Default User"` |
| `CreatedAt` | timestamptz | not null, default `now()` | Set once at creation; immutable |

**Seeded default user** (applied on first startup if no user row exists):
```
Id          = 00000000-0000-0000-0000-000000000001
DisplayName = "Default User"
CreatedAt   = <time of first startup>
```

The deterministic UUID ensures the seeder is idempotent across container restarts.

**State transitions**: Users are created by the seeder and persist indefinitely. No update or delete operations in this iteration.

---

## WeightEntry

A single weight measurement logged by a user. Immutable after creation.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `Id` | UUID | PK, not null | Client-supplied (preserves localStorage UUID for idempotent migration) or server-generated |
| `UserId` | UUID | FK → User.Id, not null, indexed | Multi-tenancy ownership key |
| `WeightValue` | decimal(10, 4) | not null | Stored in the unit specified by `Unit` |
| `Unit` | varchar(3) | not null, CHECK IN ('kg', 'lbs') | Unit the value was entered in |
| `Timestamp` | timestamptz | not null | When the user recorded the measurement |
| `CreatedAt` | timestamptz | not null, default `now()` | Server receipt time |

**Validation rules** (enforced by the API before persistence):

| Rule | Constraint |
|------|-----------|
| Value range (kg) | `WeightValue` ≥ 1 AND ≤ 635 |
| Value range (lbs) | `WeightValue` ≥ 2 AND ≤ 1400 |
| Unit | Must be exactly `"kg"` or `"lbs"` |
| Timestamp | Must be a valid ISO 8601 date-time |

**Uniqueness / idempotency**: `Id` is globally unique. A `POST /api/entries` or `POST /api/migrate` request supplying a duplicate `Id` results in an insert-or-skip (the existing row is preserved, no error returned). This satisfies FR-018.

**State transitions**:

```
[created] → [deleted]
```

Entries are immutable after creation. The only mutations are single-entry deletion and bulk deletion (all entries for the current user).

**Indexes**:
- `(UserId, Timestamp DESC)` — composite index; supports the entry list query and the daily-averages aggregation used by chart calculation.

---

## ChartSettings

Per-user configuration for corridor calculations and display preferences. Exactly one record per user; created by the database seeder.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `Id` | UUID | PK, not null | Server-generated |
| `UserId` | UUID | FK → User.Id, not null, UNIQUE | Enforces 1:1 with User |
| `PreferredUnit` | varchar(3) | not null, CHECK IN ('kg', 'lbs'), default `'kg'` | Persisted unit preference (replaces localStorage unit pref) |
| `WeightGoal` | decimal(10, 4) | nullable | Target body weight expressed in `PreferredUnit`; null means no goal set |
| `LossRate` | decimal(10, 6) | not null, > 0, default `0.005500` | Daily fractional weight-loss rate |
| `CarbFatRatio` | decimal(10, 6) | not null, > 0, default `0.600000` | Carbohydrate-to-fat energy ratio |
| `BufferValue` | decimal(10, 6) | not null, > 0, default `0.007500` | Corridor width coefficient |
| `UpdatedAt` | timestamptz | not null, default `now()` | Updated on every `PUT /api/settings` |

**Seeded defaults** (for the default user, on first startup):
```
PreferredUnit = 'kg'
WeightGoal    = NULL
LossRate      = 0.005500
CarbFatRatio  = 0.600000
BufferValue   = 0.007500
```

**Validation rules** (enforced by the API on `PUT /api/settings`):

| Field | Rule |
|-------|------|
| `PreferredUnit` | Must be `"kg"` or `"lbs"` |
| `WeightGoal` | > 0 if provided; null is valid |
| `LossRate` | > 0 |
| `CarbFatRatio` | > 0 |
| `BufferValue` | > 0 |

**State transitions**: Created once by the seeder; updated (never deleted) via `PUT /api/settings`.

---

## ChartDataSet (Computed Response Model — Not Stored)

Returned by `GET /api/chart`. Produced on demand from `WeightEntry` records and `ChartSettings`; never persisted to the database.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `CorridorState` | string enum | no | `"ready"` \| `"no-goal"` \| `"calibrating"` \| `"no-data"` |
| `Unit` | string | no | Unit all values are expressed in — equals `ChartSettings.PreferredUnit` |
| `DataPoints` | ChartPoint[] | no | Raw daily averages; always present when entries exist |
| `Trendline` | ChartPoint[] | yes | Non-null only when `CorridorState = "ready"` |
| `Floor` | ChartPoint[] | yes | Non-null only when `CorridorState = "ready"` |
| `Ceiling` | ChartPoint[] | yes | Non-null only when `CorridorState = "ready"` |
| `Ideal` | ChartPoint[] | yes | Non-null only when `CorridorState = "ready"` |

**ChartPoint**:

| Field | Type | Notes |
|-------|------|-------|
| `Date` | string (YYYY-MM-DD) | Calendar day |
| `Value` | decimal | Weight expressed in `ChartDataSet.Unit` |

**CorridorState decision logic** (direct port of existing TypeScript `chart-calculations.ts`):

| State | Condition |
|-------|-----------|
| `"no-data"` | Zero entries |
| `"no-goal"` | Entries present; `WeightGoal` is null |
| `"calibrating"` | Entries present; goal set; span < 7 distinct calendar days |
| `"ready"` | Entries span ≥ 7 distinct calendar days AND goal is set |

---

## DailyAverage (Internal Computation — Not Stored)

Used internally by `ChartCalculationService` to aggregate multiple entries on the same calendar day before computing corridor lines.

| Field | Notes |
|-------|-------|
| `Date` | Calendar day (local timezone of the entry timestamp) |
| `DayIndex` | 0-based offset from the earliest entry's calendar day |
| `AvgWeight` | Mean of all entries on this calendar day, converted to `ChartSettings.PreferredUnit` |
| `Origin` | `"measured"` — has real entries; `"interpolated"` — gap-filled between measured days |

---

## Index Strategy

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `WeightEntries` | `(UserId, Timestamp DESC)` | Composite B-tree | Entry list query and daily-averages aggregation |
| `ChartSettings` | `UserId` | Unique B-tree | Enforces 1:1 with User; settings lookup by user |

---

## Unit Conversion Reference

Conversion is applied by `ChartCalculationService` when the entry's stored `Unit` differs from `ChartSettings.PreferredUnit`:

| From | To | Formula |
|------|----|---------|
| `kg` | `lbs` | value × 2.20462 |
| `lbs` | `kg` | value × 0.453592 |
| same | same | value (no-op) |
