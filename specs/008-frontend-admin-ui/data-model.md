# Data Model: Frontend Admin UI and User-Facing Pages

**Feature**: 008-frontend-admin-ui
**Date**: 2026-03-16

---

## Frontend Type Changes

### 1. `AuthState` (modified — `frontend/src/ts/auth-guard.ts`)

Adds an optional `role` field populated from the decoded JWT access token.

```typescript
export interface AuthState {
  isAuthenticated: boolean;
  setupRequired: boolean;
  role?: string;      // NEW — "admin" | "user" | null (undefined if unauthenticated)
  error?: string;
}
```

**Rules**:
- `role` is populated by calling `getUserRole()` from `auth-token.ts` after a successful token refresh in `checkAuthStatus()`
- `role` is `undefined` (not set) when `isAuthenticated` is `false`
- `enforceRedirect("admin", state)` checks `state.role === "admin"` to allow access; any other role or `undefined` redirects to `/index.html`

---

### 2. `getUserRole()` (new — `frontend/src/ts/auth-token.ts`)

Decodes the in-memory JWT access token to extract the role claim.

```typescript
export function getUserRole(): string | null
```

**Behaviour**:
- Returns `null` if no access token is present or if the token cannot be decoded
- Checks both the ASP.NET Core URI claim name (`http://schemas.microsoft.com/ws/2008/06/identity/claims/role`) and the shorthand `"role"` key
- Never throws — any decode error returns `null`

---

### 3. `AuditLogEntryDto` (modified — `frontend/src/ts/api-client.ts`)

Adds `actorUsername` and `targetUsername` to match the amended backend response.

```typescript
export interface AuditLogEntryDto {
  id: string;
  actionType: string;
  actorUserId: string;
  actorUsername: string;        // NEW — resolved server-side
  targetUserId: string | null;
  targetUsername: string | null; // NEW — resolved server-side; null if no target
  ipAddress: string;
  timestamp: string;
}
```

**Rules**:
- `actorUsername` is always a non-empty string (every audit entry has an actor)
- `targetUsername` is `null` for actions that have no target user (e.g., system events)
- `ipAddress` remains in the DTO but is not displayed in the admin dashboard UI (stored for backend use only)

---

## Backend Amendment

### 4. Audit Log Endpoint Response Projection (modified — `backend/WeightTracker.Api/Endpoints/AdminEndpoints.cs`)

The `GET /api/admin/audit-log` endpoint response currently returns `AuditLogEntry` entity fields directly. The amended projection adds `actorUsername` and `targetUsername` resolved via a LEFT JOIN with the `Users` table.

**No database migration required** — no new columns are added. This is a query-time projection only.

**Amended response entry shape**:

```json
{
  "id": "guid",
  "actionType": "UserDeactivated",
  "actorUserId": "guid",
  "actorUsername": "admin_user",
  "targetUserId": "guid",
  "targetUsername": "target_user",
  "ipAddress": "127.0.0.1",
  "timestamp": "2026-03-16T10:00:00Z"
}
```

**Repository change** (`WeightTracker.Infrastructure/Repositories/AuditLogRepository.cs`):
- `QueryAsync` projects to a record/anonymous type that joins `Users` table on both `ActorUserId` and `TargetUserId` (LEFT JOINs)
- Uses EF Core `DbContext.Set<ApplicationUser>().Where(...)` or navigation properties to resolve usernames

---

## Page Entry File Modules (new)

### 5. `reset-request.ts` (`frontend/src/ts/`)

No persistent state. Stateless form submission module.

**Key DOM dependencies** (contract with `reset-request.html`):
- `#reset-request-form` — form element
- `#email-input` — email input
- `#feedback-msg` — feedback message (always success)

---

### 6. `reset-complete.ts` (`frontend/src/ts/`)

Reads `token` query parameter from URL on load.

**Key DOM dependencies** (contract with `reset-complete.html`):
- `#reset-complete-form` — form element
- `#new-password-input` — new password
- `#confirm-password-input` — confirm password
- `#feedback-msg` — success or error message
- `#token-error-msg` — shown immediately if token param missing from URL

---

### 7. `profile.ts` (`frontend/src/ts/`)

Three independent form sections; no shared state between them.

**Key DOM dependencies** (contract with `profile.html`):
- `#username-form`, `#username-input`, `#username-feedback`
- `#email-form`, `#email-input`, `#email-feedback`
- `#password-form`, `#current-password-input`, `#new-password-input`, `#confirm-password-input`, `#password-feedback`

---

### 8. `admin.ts` (`frontend/src/ts/`)

Module-level state for user list and audit log pagination.

**Key DOM dependencies** (contract with `admin.html`):
- `#stats-total-users`, `#stats-active-sessions` — summary stats bar
- `#user-table-body` — `<tbody>` for user management table
- `#create-user-btn`, `#create-user-modal` — modal trigger and `<dialog>`
- `#create-user-form`, `#cu-username`, `#cu-email`, `#cu-role`, `#cu-feedback` — create user form fields
- `#audit-table-body` — `<tbody>` for audit log table
- `#audit-filter-from`, `#audit-filter-to`, `#audit-filter-action` — filter inputs
- `#audit-apply-btn` — apply filters button
- `#audit-prev-btn`, `#audit-next-btn`, `#audit-page-indicator` — pagination controls

**Module-level state**:
```typescript
let _users: AdminUserDto[] = [];
let _currentUserId: string | null = null;   // logged-in admin's own ID (from JWT sub claim)
let _auditPage: number = 1;
let _auditFilters: AuditLogParams = {};
let _auditTotalCount: number = 0;
```
