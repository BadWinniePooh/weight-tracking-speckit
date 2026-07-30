# Frontend Contracts: Page DOM and Module Interfaces

**Feature**: 008-frontend-admin-ui
**Date**: 2026-03-16

These contracts define the DOM element IDs each TypeScript entry file depends on, and the function signatures of modified shared modules. Test files must use these same IDs when setting up jsdom fixtures.

---

## Modified Shared Modules

### `auth-token.ts` — new export

```typescript
// Decodes the in-memory JWT access token to extract the role claim.
// Returns null if no token or decode fails. Never throws.
export function getUserRole(): string | null
```

---

### `auth-guard.ts` — modified exports

```typescript
// Extended AuthState — adds optional role field
export interface AuthState {
  isAuthenticated: boolean;
  setupRequired: boolean;
  role?: string;   // populated when isAuthenticated = true
  error?: string;
}

// Extended enforceRedirect — adds "profile" and "admin" and "public" page types
// "profile" : requires isAuthenticated; unauthenticated → /login.html
// "admin"   : requires isAuthenticated + role === "admin";
//             unauthenticated → /login.html; non-admin → /index.html
// "public"  : no requirements; always no-op
export function enforceRedirect(
  pageType: "app" | "login" | "setup" | "profile" | "admin" | "public",
  state: AuthState
): void
```

---

### `api-client.ts` — modified interface

```typescript
// AuditLogEntryDto — adds actorUsername and targetUsername
export interface AuditLogEntryDto {
  id: string;
  actionType: string;
  actorUserId: string;
  actorUsername: string;         // NEW
  targetUserId: string | null;
  targetUsername: string | null; // NEW
  ipAddress: string;
  timestamp: string;
}
```

---

## New Pages

### `reset-request.html` + `reset-request.ts`

**Auth**: `enforceRedirect("public", state)` — publicly accessible

**Required DOM element IDs**:
| ID | Element | Purpose |
|----|---------|---------|
| `reset-request-form` | `<form>` | Form submission |
| `email-input` | `<input type="email">` | Email address field |
| `feedback-msg` | `<div>` | Always-success feedback (anti-enumeration) |
| `submit-btn` | `<button>` | Submit button (disabled during request) |

**API call**: `api-client.requestPasswordReset(email)` → POST `/api/auth/forgot-password`

**Behaviour**:
- On submit (success or 4xx): show the same success message in `#feedback-msg`
- On network error: show a generic "unable to reach server" message
- `#submit-btn` disabled while request in-flight

---

### `reset-complete.html` + `reset-complete.ts`

**Auth**: `enforceRedirect("public", state)` — publicly accessible

**Required DOM element IDs**:
| ID | Element | Purpose |
|----|---------|---------|
| `reset-complete-form` | `<form>` | Form submission |
| `new-password-input` | `<input type="password">` | New password |
| `confirm-password-input` | `<input type="password">` | Confirm new password |
| `feedback-msg` | `<div>` | Success or error feedback |
| `token-error-msg` | `<div>` | Shown immediately if token is missing from URL |
| `submit-btn` | `<button>` | Submit button (disabled if no token) |

**URL token**: read from `new URLSearchParams(window.location.search).get("token")`

**API call**: `api-client.resetPassword(token, newPassword)` → POST `/api/auth/reset-password`

**Behaviour**:
- On load: if `token` absent from URL, show `#token-error-msg` and disable `#submit-btn`
- Client-side validation: new password and confirm password must match before submitting
- On success (200): redirect to `/login.html`
- On 400 (invalid/expired token): show error in `#feedback-msg`

---

### `profile.html` + `profile.ts`

**Auth**: `enforceRedirect("profile", state)` — requires authentication

**Required DOM element IDs**:
| ID | Element | Purpose |
|----|---------|---------|
| `username-form` | `<form>` | Change username section |
| `username-input` | `<input type="text">` | New username |
| `username-feedback` | `<div>` | Inline success/error |
| `email-form` | `<form>` | Change email section |
| `email-input` | `<input type="email">` | New email |
| `email-feedback` | `<div>` | Inline success/error + confirmation notice |
| `password-form` | `<form>` | Change password section |
| `current-password-input` | `<input type="password">` | Current password |
| `new-password-input` | `<input type="password">` | New password |
| `confirm-password-input` | `<input type="password">` | Confirm new password |
| `password-feedback` | `<div>` | Inline success/error |

**API calls**:
- `api-client.changeUsername(newUsername)` → PUT `/api/account/username`
- `api-client.changeEmail(newEmail)` → PUT `/api/account/email`
- `api-client.changePassword(currentPassword, newPassword)` → PUT `/api/account/password`

**Behaviour**:
- Each form submits independently — no shared state
- Email success: show notice "A confirmation email has been sent to [email]. Your current email remains active until confirmed."
- All feedback shown inline in the respective `*-feedback` element without page reload

---

### `admin.html` + `admin.ts`

**Auth**: `enforceRedirect("admin", state)` — requires authentication + admin role

**Required DOM element IDs** — Stats Bar:
| ID | Element | Purpose |
|----|---------|---------|
| `stats-total-users` | `<span>` | Total user count |
| `stats-active-sessions` | `<span>` | Active session count |

**Required DOM element IDs** — User Table:
| ID | Element | Purpose |
|----|---------|---------|
| `user-table-body` | `<tbody>` | User management table body |
| `create-user-btn` | `<button>` | Opens create user modal |
| `create-user-modal` | `<dialog>` | Create user modal |
| `create-user-form` | `<form>` | Inside modal |
| `cu-username` | `<input type="text">` | New user's username |
| `cu-email` | `<input type="email">` | New user's email |
| `cu-role` | `<select>` | Role: `user` or `admin` |
| `cu-feedback` | `<div>` | Inline error inside modal |

**Required DOM element IDs** — Audit Log:
| ID | Element | Purpose |
|----|---------|---------|
| `audit-table-body` | `<tbody>` | Audit log table body |
| `audit-filter-from` | `<input type="date">` | From date filter |
| `audit-filter-to` | `<input type="date">` | To date filter |
| `audit-filter-action` | `<select>` | Action type filter dropdown |
| `audit-apply-btn` | `<button>` | Apply filters |
| `audit-prev-btn` | `<button>` | Previous page |
| `audit-next-btn` | `<button>` | Next page |
| `audit-page-indicator` | `<span>` | "Page X of Y" indicator |

**User table row data attributes** (generated by `admin.ts`):
| Attribute | Purpose |
|-----------|---------|
| `data-user-id` | User's UUID (on `<tr>`) |
| `data-action` | Action type: `deactivate`, `reactivate`, `delete`, `change-role`, `resend-confirmation` (on action `<button>`) |

**API calls (user management)**:
- `adminListUsers()` → GET `/api/admin/users`
- `adminCreateUser(username, email, role)` → POST `/api/admin/users`
- `adminDeactivateUser(id)` → POST `/api/admin/users/:id/deactivate`
- `adminReactivateUser(id)` → POST `/api/admin/users/:id/reactivate`
- `adminDeleteUser(id)` → DELETE `/api/admin/users/:id`
- `adminAssignRole(id, role)` → PUT `/api/admin/users/:id/role`
- `adminResendConfirmation(id)` → POST `/api/admin/users/:id/resend-confirmation`

**API calls (audit log)**:
- `adminGetAuditLog({ page, pageSize: 20, fromDate, toDate, actionType })` → GET `/api/admin/audit-log`

**Stats derivation** (client-side, no API call):
- `totalUsers = _users.length`
- `activeSessions = _users.filter(u => u.isActive && u.lastLoginAt !== null).length`

---

## Navigation Modifications

### `index.html` (modified)

Add to `<header>`:
```html
<a href="/profile.html" id="nav-profile">Profile</a>
<a href="/admin.html" id="nav-admin" hidden>Admin Dashboard</a>
```

`main.ts` (modified): after `checkAuthStatus()`, if `state.role === "admin"`, remove `hidden` from `#nav-admin`.

### `login.html` (modified)

Add below the sign-in form:
```html
<a href="/reset-request.html" id="forgot-password-link">Forgot password?</a>
```

---

## Vite Entry Points (modified — `frontend/vite.config.ts`)

```typescript
rollupOptions: {
  input: {
    main: resolve(__dirname, "src/index.html"),
    login: resolve(__dirname, "src/login.html"),
    setup: resolve(__dirname, "src/setup.html"),
    resetRequest: resolve(__dirname, "src/reset-request.html"),    // NEW
    resetComplete: resolve(__dirname, "src/reset-complete.html"),  // NEW
    profile: resolve(__dirname, "src/profile.html"),               // NEW
    admin: resolve(__dirname, "src/admin.html"),                   // NEW
  },
},
```
