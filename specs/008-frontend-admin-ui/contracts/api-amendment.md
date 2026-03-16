# API Contract Amendment: Audit Log Response

**Feature**: 008-frontend-admin-ui
**Date**: 2026-03-16
**Scope**: Single endpoint amendment — no new endpoints, no DB migrations

---

## Amended Endpoint

### GET /api/admin/audit-log

**Authorization**: Bearer JWT — admin role required

**Query parameters** (unchanged):
| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `pageSize` | int | Entries per page (default: 50, max: 200; frontend uses 20) |
| `fromDate` | string (ISO 8601) | Optional start date filter |
| `toDate` | string (ISO 8601) | Optional end date filter |
| `actionType` | string | Optional action type filter |

**Response 200** (amended — `actorUsername` and `targetUsername` added):
```json
{
  "entries": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "actionType": "UserDeactivated",
      "actorUserId": "11111111-1111-1111-1111-111111111111",
      "actorUsername": "admin_user",
      "targetUserId": "22222222-2222-2222-2222-222222222222",
      "targetUsername": "regular_user",
      "ipAddress": "127.0.0.1",
      "timestamp": "2026-03-16T10:00:00Z"
    }
  ],
  "totalCount": 42,
  "page": 1,
  "pageSize": 20
}
```

**Changed fields** (vs. current response):
| Field | Before | After |
|-------|--------|-------|
| `actorUsername` | absent | `string` — always present (resolved via JOIN) |
| `targetUsername` | absent | `string \| null` — null if no target user |

**Fields retained unchanged**: `id`, `actionType`, `actorUserId`, `targetUserId`, `ipAddress`, `timestamp`, `totalCount`, `page`, `pageSize`

**Backward compatibility**: Additive-only change. Existing clients that ignore unknown fields are unaffected.

---

## Backend Implementation Notes

**File**: `backend/WeightTracker.Infrastructure/Repositories/AuditLogRepository.cs`

The `QueryAsync` method must be updated to project `actorUsername` and `targetUsername` by joining the `Users` table:
- `ActorUserId` → LEFT JOIN `Users` on `Id` → `Username` (always non-null; every audit entry has a valid actor at write time)
- `TargetUserId` → LEFT JOIN `Users` on `Id` → `Username` (nullable; null if `TargetUserId` is null or user was deleted)

**File**: `backend/WeightTracker.Api/Endpoints/AdminEndpoints.cs`

The `Results.Ok(new { entries = result.Entries, ... })` projection must be updated to use the amended result type that includes `actorUsername` and `targetUsername`.

**No migration required**: Query-time JOIN only. The `Users` table already exists with a `Username` column.

**Test file to update**: `backend/WeightTracker.Tests/Integration/Endpoints/AuditLogEndpointsTests.cs`
- Add a test asserting `actorUsername` is present and non-null in the response
- Add a test asserting `targetUsername` is null when the action has no target
