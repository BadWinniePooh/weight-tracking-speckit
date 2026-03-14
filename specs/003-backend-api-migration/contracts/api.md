# API Contract: Weight Tracker Backend (003)

**Date**: 2026-03-14
**Base URL**: Configured at runtime via `API_URL` environment variable (e.g., `http://localhost:8080`)
**Auth**: None in this iteration. All requests are implicitly attributed to the default seeded user via stub middleware.
**Content-Type**: `application/json` for all request and response bodies.

---

## Common Response Shapes

### Error Response

Returned on `400 Bad Request` and `404 Not Found`.

```json
{
  "error": "Human-readable error message.",
  "field": "fieldName"
}
```

`field` is omitted for non-field-specific errors (e.g., resource not found).

### 500 Internal Server Error

```json
{
  "error": "An unexpected error occurred."
}
```

---

## System

### GET /health

Returns the health status of the backend and its database connectivity.

**Response: 200 OK** (service healthy)

```json
{
  "status": "Healthy",
  "checks": {
    "database": "Healthy"
  }
}
```

**Response: 503 Service Unavailable** (database unreachable)

```json
{
  "status": "Unhealthy",
  "checks": {
    "database": "Unhealthy"
  }
}
```

Used by docker-compose `healthcheck` to gate dependent container startup.

---

## Weight Entries

### GET /api/entries

Returns all weight entries for the current user, sorted newest-first.

**Response: 200 OK**

```json
{
  "entries": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "weightValue": 75.5,
      "unit": "kg",
      "timestamp": "2026-03-14T09:15:00Z"
    }
  ]
}
```

`entries` is an empty array `[]` when no entries exist.

---

### POST /api/entries

Creates a new weight entry for the current user.

**Request body**

```json
{
  "weightValue": 75.5,
  "unit": "kg",
  "timestamp": "2026-03-14T09:15:00Z",
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `weightValue` | Yes | Positive decimal |
| `unit` | Yes | `"kg"` or `"lbs"` |
| `timestamp` | Yes | ISO 8601 date-time |
| `id` | No | Client-supplied UUID; if omitted, server generates one. If supplied and already exists, entry is returned as-is (idempotent — used by migration tool). |

**Response: 201 Created**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "weightValue": 75.5,
  "unit": "kg",
  "timestamp": "2026-03-14T09:15:00Z"
}
```

**Response: 400 Bad Request** (validation failure)

```json
{
  "error": "Weight value must be greater than zero.",
  "field": "weightValue"
}
```

---

### DELETE /api/entries/{id}

Deletes a single weight entry by ID.

**Path parameter**: `id` — UUID of the entry to delete.

**Response: 204 No Content** — entry deleted.

**Response: 404 Not Found** — no entry with that ID exists for the current user.

```json
{
  "error": "Entry not found."
}
```

---

### DELETE /api/entries

Deletes all weight entries for the current user.

**Response: 204 No Content** — all entries deleted (or none existed; either way succeeds).

---

## Chart Settings

### GET /api/settings

Returns the current chart settings for the current user.

**Response: 200 OK**

```json
{
  "preferredUnit": "kg",
  "weightGoal": null,
  "lossRate": 0.0055,
  "carbFatRatio": 0.6,
  "bufferValue": 0.0075
}
```

`weightGoal` is `null` when no goal has been set.

---

### PUT /api/settings

Replaces all chart settings for the current user. All fields are required.

**Request body**

```json
{
  "preferredUnit": "lbs",
  "weightGoal": 180.0,
  "lossRate": 0.0055,
  "carbFatRatio": 0.6,
  "bufferValue": 0.0075
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `preferredUnit` | Yes | `"kg"` or `"lbs"` |
| `weightGoal` | Yes (nullable) | Positive decimal, or `null` to clear goal |
| `lossRate` | Yes | Must be > 0 |
| `carbFatRatio` | Yes | Must be > 0 |
| `bufferValue` | Yes | Must be > 0 |

**Response: 200 OK** — returns the updated settings (same shape as GET /api/settings).

**Response: 400 Bad Request** (validation failure)

```json
{
  "error": "Loss rate must be greater than zero.",
  "field": "lossRate"
}
```

---

## Chart Data

### GET /api/chart

Returns pre-computed chart data for the current user. All values are expressed in the user's `ChartSettings.PreferredUnit`. The frontend renders this data directly with no further calculation.

**Response: 200 OK — no data**

```json
{
  "corridorState": "no-data",
  "unit": "kg",
  "dataPoints": [],
  "trendline": null,
  "floor": null,
  "ceiling": null,
  "ideal": null
}
```

**Response: 200 OK — data present, no corridor (no goal set)**

```json
{
  "corridorState": "no-goal",
  "unit": "kg",
  "dataPoints": [
    { "date": "2026-03-14", "value": 75.5 },
    { "date": "2026-03-13", "value": 75.8 }
  ],
  "trendline": null,
  "floor": null,
  "ceiling": null,
  "ideal": null
}
```

**Response: 200 OK — calibrating (< 7 days of data)**

```json
{
  "corridorState": "calibrating",
  "unit": "kg",
  "dataPoints": [
    { "date": "2026-03-14", "value": 75.5 }
  ],
  "trendline": null,
  "floor": null,
  "ceiling": null,
  "ideal": null
}
```

**Response: 200 OK — corridor ready**

```json
{
  "corridorState": "ready",
  "unit": "kg",
  "dataPoints": [
    { "date": "2026-03-14", "value": 75.5 }
  ],
  "trendline": [
    { "date": "2026-03-14", "value": 75.3 }
  ],
  "floor": [
    { "date": "2026-03-14", "value": 74.8 }
  ],
  "ceiling": [
    { "date": "2026-03-14", "value": 75.9 }
  ],
  "ideal": [
    { "date": "2026-03-14", "value": 75.0 }
  ]
}
```

`trendline`, `floor`, `ceiling`, and `ideal` are `null` for all states other than `"ready"`.

---

## Data Migration

### POST /api/migrate

One-time bulk import of weight entries and chart settings from the client's localStorage. Designed to be idempotent — re-submitting the same payload produces no duplicates.

**Request body**

```json
{
  "entries": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "weightValue": 75.5,
      "unit": "kg",
      "timestamp": "2026-03-14T09:15:00Z"
    }
  ],
  "settings": {
    "preferredUnit": "kg",
    "weightGoal": null,
    "lossRate": 0.0055,
    "carbFatRatio": 0.6,
    "bufferValue": 0.0075
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `entries` | Yes | Array of entry objects; may be empty |
| `entries[].id` | Yes | Original localStorage UUID — used for deduplication |
| `entries[].weightValue` | Yes | As stored in localStorage |
| `entries[].unit` | Yes | `"kg"` or `"lbs"` |
| `entries[].timestamp` | Yes | ISO 8601 |
| `settings` | No | If omitted, existing server settings are not changed |

**Response: 200 OK**

```json
{
  "migratedEntries": 5,
  "skippedEntries": 1,
  "settingsMigrated": true,
  "skippedReasons": [
    "Entry 3fa85f64-...: weight value 9999 exceeds maximum for unit 'kg'"
  ]
}
```

| Field | Notes |
|-------|-------|
| `migratedEntries` | Count of entries successfully inserted (excludes duplicates and invalid entries) |
| `skippedEntries` | Count of entries that failed validation or were duplicates |
| `settingsMigrated` | `true` if settings were provided and applied; `false` if omitted or invalid |
| `skippedReasons` | Human-readable reason for each skipped entry |

The endpoint always returns `200 OK` as long as the request body is well-formed JSON. Individual entry failures do not cause the whole request to fail (FR-017).

**Response: 400 Bad Request** — malformed JSON body or `entries` field missing entirely.

---

## Error Code Summary

| HTTP Status | When used |
|-------------|-----------|
| 200 OK | Successful GET or PUT |
| 201 Created | Successful POST /api/entries |
| 204 No Content | Successful DELETE |
| 400 Bad Request | Validation failure on request body |
| 404 Not Found | Resource does not exist for the current user |
| 503 Service Unavailable | Health check — database unreachable |
| 500 Internal Server Error | Unexpected server-side error |
