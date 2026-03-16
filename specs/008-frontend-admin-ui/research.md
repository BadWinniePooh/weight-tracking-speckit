# Research: Frontend Admin UI and User-Facing Pages

**Feature**: 008-frontend-admin-ui
**Date**: 2026-03-16
**Status**: Complete — all decisions resolved

---

## Decision 1: JWT Role Extraction (Client-Side)

**Decision**: Decode the JWT access token payload client-side by base64-decoding the middle segment and parsing the JSON. Extract the `role` claim. Add `getUserRole(): string | null` to `auth-token.ts`.

**Rationale**: The access token is already stored in-memory via `auth-token.ts`. The `role` claim is a standard JWT payload field set by the backend's `ClaimTypes.Role`. Base64 decoding the payload is a standard, dependency-free approach used across all major frontend frameworks. No API round-trip is needed.

**Implementation note**:
```typescript
export function getUserRole(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Backend uses ClaimTypes.Role which maps to the full URI claim name
    return payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
      ?? payload['role']
      ?? null;
  } catch {
    return null;
  }
}
```

**Claim name note**: ASP.NET Core serialises `ClaimTypes.Role` as `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` in JWT. The implementation should check both that URI and the shorthand `"role"` key to be resilient.

**Alternatives considered**:
- Add a `/api/auth/me` endpoint that returns role — unnecessary API call for data already in the token
- Parse role in each page's TS file — duplication; centralising in `auth-token.ts` follows the existing single-responsibility pattern

---

## Decision 2: Auth Guard Role Extension

**Decision**: Extend `AuthState` to include `role?: string`. Extend `enforceRedirect` to accept a new `"admin"` page type that redirects non-admins to `/index.html` (and unauthenticated users to `/login.html`). Add a `"public"` page type (no-op) for password reset pages. Extend `checkAuthStatus()` to populate `role` from `getUserRole()` after a successful refresh.

**Rationale**: The existing `enforceRedirect` / `AuthState` pattern is well-tested (14 test cases in `auth-guard.test.ts`) and is the established pattern for all page guards in this codebase. Extending it rather than creating a new guard keeps all redirect logic in one place and allows existing tests to be extended naturally.

**New page type behaviours**:
| `pageType` | Unauthenticated | Authenticated (non-admin) | Authenticated (admin) |
|------------|----------------|--------------------------|----------------------|
| `"app"` | → `/login.html` | no redirect | no redirect |
| `"login"` | no redirect | → `/index.html` | → `/index.html` |
| `"setup"` | (unchanged) | (unchanged) | (unchanged) |
| `"profile"` (new) | → `/login.html` | no redirect | no redirect |
| `"admin"` (new) | → `/login.html` | → `/index.html` | no redirect |
| `"public"` (new) | no redirect | no redirect | no redirect |

**Alternatives considered**:
- Separate `enforceAdminRedirect()` function — splits logic without benefit; harder to test; violates YAGNI
- Check role in each page's entry TS file — duplicates guard logic across 4 files

---

## Decision 3: Admin Dashboard State Management

**Decision**: Use module-level variables (same pattern as `main.ts`) to hold the user list and current audit log page state. No reactive framework or external state store.

**Rationale**: Consistent with the existing codebase pattern (`_chartInstance`, `_entries`, `_preferredUnit` in `main.ts`). Vitest + jsdom tests mock DOM and module-level state effectively. No new dependency introduced.

**State variables** (in `admin.ts`):
- `_users: AdminUserDto[]` — loaded once on page init, mutated in place after each action
- `_currentPage: number` — audit log current page (default 1)
- `_auditFilters: AuditLogParams` — active filter state

**Alternatives considered**:
- Alpine.js or similar micro-framework — introduces a new dependency; violates YAGNI and the "no new npm packages" constraint
- Re-fetch full user list after every action — simpler but creates unnecessary API calls; table flicker on each action

---

## Decision 4: Audit Log Backend Amendment (actorUsername / targetUsername)

**Decision**: Amend the `GET /api/admin/audit-log` endpoint response to include `actorUsername` (string) and `targetUsername` (string | null) alongside the existing `actorUserId` and `targetUserId`. Resolution is done via a JOIN in `AuditLogRepository.QueryAsync` using EF Core's `Include` / navigation property or an inline projection.

**Rationale**: The frontend cannot resolve user IDs to usernames without an additional API call per entry, which would be impractical for a paginated table. A server-side JOIN is the standard approach and is already supported by the EF Core context.

**Implementation approach**: Add a computed projection in the repository rather than changing the `AuditLogEntry` entity (no DB schema change). The `QueryAsync` method projects to an anonymous/record type that includes the joined username from the `Users` table:

```csharp
// In AuditLogRepository.QueryAsync — projection shape:
new {
    entry.Id,
    entry.ActionType,
    entry.ActorUserId,
    ActorUsername = actorUser.Username,   // LEFT JOIN on Users
    entry.TargetUserId,
    TargetUsername = targetUser == null ? null : targetUser.Username,  // LEFT JOIN
    entry.IpAddress,
    entry.Timestamp
}
```

**No DB migration required**: `Username` is already in the `Users` table. This is a query-time JOIN only.

**Alternatives considered**:
- Add `ActorUsername` column to `AuditLog` table — denormalised; requires migration; data gets stale if usernames change
- Client-side resolution (cross-reference user list with audit entries) — complex, O(n²) for large lists, breaks for deleted users

---

## Decision 5: Confirmation Dialogs

**Decision**: Use `window.confirm()` for all destructive action confirmations (deactivate, delete). This is consistent with the existing pattern in `main.ts` (`window.confirm("Delete this entry?")` on line 296).

**Rationale**: No new dependency; already established in the codebase; easy to stub in Vitest tests (`vi.spyOn(window, 'confirm')`).

**Alternatives considered**:
- Custom modal dialog — adds visual polish but introduces significant implementation complexity for no functional gain; violates YAGNI
- Browser's `<dialog>` element — appropriate for Create User (which needs form fields) but overkill for simple yes/no confirmations

---

## Decision 6: Create User Modal

**Decision**: Use a `<dialog>` element for the Create User modal (consistent with the existing chart settings modal in `index.html`). The modal contains a form with username, email, and role (select: `user` / `admin`) fields. On success, prepend the new user row to the table DOM without re-fetching the full list.

**Rationale**: `<dialog>` is the established pattern in this codebase. No new dependency. Works correctly with `showModal()` / `close()` and backdrop click dismissal.

**Alternatives considered**:
- Re-fetch full user list after create — simpler but causes a full table re-render (flash) and an extra network request
- Inline row insertion via template literal — appropriate given no frontend framework in use
