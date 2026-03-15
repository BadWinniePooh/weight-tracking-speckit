# API Contracts: Multi-User Support and Authentication

**Feature**: 005-jwt-multi-user-auth
**Date**: 2026-03-14

> All existing endpoints (`/api/entries`, `/api/chart`, `/api/settings`, `/api/migrate`) are unchanged in shape. They gain JWT authentication enforcement only.

---

## Authentication conventions

**Access token**: All protected endpoints require `Authorization: Bearer <access_token>` header.

**Refresh token**: Carried in an HttpOnly, Secure, SameSite=Strict cookie named `refreshToken`. Sent automatically by the browser when `credentials: 'include'` is used.

**Error shape** (all error responses):
```json
{ "error": "Human-readable message" }
```

**Auth errors**:
- `401 Unauthorized` — missing or invalid access token, or expired session
- `403 Forbidden` — authenticated but insufficient role

---

## New Endpoints

### GET /api/auth/status

Returns boot-time information. **Public — no authentication required.**

**Response 200**:
```json
{
  "firstRun": false,
  "smtpConfigured": true
}
```

| Field | Description |
|-------|-------------|
| `firstRun` | `true` when no users exist and admin env vars are absent |
| `smtpConfigured` | `true` when all five SMTP env vars are present |

**Frontend use**: Called once on page load. If `firstRun = true`, redirect to setup wizard. If `smtpConfigured = false`, hide the "Forgot password?" link on the login page.

---

### POST /api/auth/setup *(first-run only)*

Creates the initial admin account. **Public — only functional when `firstRun = true`.**

Returns `409 Conflict` if any user already exists.

**Request body**:
```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "s3cur3pass"
}
```

| Field | Rules |
|-------|-------|
| `username` | 3–100 chars, alphanumeric + underscore + hyphen, unique |
| `email` | valid email format, unique |
| `password` | minimum 8 characters |

**Response 200**:
```json
{
  "accessToken": "<jwt>"
}
```
Sets `refreshToken` cookie (HttpOnly, Secure, SameSite=Strict, MaxAge=30 days).

**Error responses**:

| Status | When |
|--------|------|
| `400` | Validation failure — `{ "error": "...", "field": "username" \| "email" \| "password" }` |
| `409` | Users already exist; first-run mode is closed |

---

### POST /api/auth/login

**Public — no authentication required.**

**Request body**:
```json
{
  "username": "alice",
  "password": "s3cur3pass"
}
```

**Response 200**:
```json
{
  "accessToken": "<jwt>"
}
```
Sets `refreshToken` cookie.

**Error responses**:

| Status | When |
|--------|------|
| `401` | Invalid credentials or deactivated account. Always: `{ "error": "Invalid username or password." }` — never reveals which field was wrong |

---

### POST /api/auth/refresh

Exchanges the `refreshToken` cookie for a new access token. **Public (cookie is the credential).**

No request body required. The browser sends the `refreshToken` cookie automatically.

**Response 200**:
```json
{
  "accessToken": "<jwt>"
}
```
Rotates the `refreshToken` cookie (old token is invalidated, new token is set).

**Error responses**:

| Status | When |
|--------|------|
| `401` | Token missing, expired, already used, or revoked |
| `403` | User account is deactivated |

On error, the `refreshToken` cookie is cleared (`MaxAge=0`).

---

### POST /api/auth/logout

Invalidates the current session. **Requires valid access token.**

No request body. The `refreshToken` cookie is used to identify which server-side token to revoke.

**Response 204**: No content. Clears `refreshToken` cookie.

---

### POST /api/auth/forgot-password

Initiates a password reset by email. **Public.**

**Request body**:
```json
{
  "email": "alice@example.com"
}
```

**Response 200** (always, regardless of whether email exists):
```json
{
  "message": "If an account exists with that email address, a reset link has been sent."
}
```

**Error responses**:

| Status | When |
|--------|------|
| `503` | SMTP is not configured — `{ "error": "Password reset is not available. Contact your administrator." }` |

---

### POST /api/auth/reset-password

Completes a password reset. **Public.**

**Request body**:
```json
{
  "token": "<reset-token-from-email>",
  "newPassword": "n3wP4ssword"
}
```

| Field | Rules |
|-------|-------|
| `token` | Non-empty string |
| `newPassword` | Minimum 8 characters |

**Response 200**:
```json
{
  "message": "Password updated successfully."
}
```

**Error responses**:

| Status | When |
|--------|------|
| `400` | Token invalid, expired, or already used — `{ "error": "Reset link is invalid or has expired." }` |
| `400` | Validation failure — `{ "error": "...", "field": "newPassword" }` |

---

## Admin User Management Endpoints

All require `Authorization: Bearer <token>` with `Role = Admin`. Non-admins receive `403`.

### GET /api/admin/users

Lists all user accounts.

**Response 200**:
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "alice",
      "email": "alice@example.com",
      "role": "User",
      "isActive": true,
      "createdAt": "2026-03-14T10:00:00Z"
    }
  ]
}
```

---

### POST /api/admin/users

Creates a new user account.

**Request body**:
```json
{
  "username": "bob",
  "email": "bob@example.com",
  "password": "initialPass8",
  "role": "User"
}
```

| Field | Rules |
|-------|-------|
| `username` | 3–100 chars, alphanumeric + underscore + hyphen, unique |
| `email` | Valid email, unique |
| `password` | Minimum 8 characters |
| `role` | `"User"` or `"Admin"` |

**Response 201**:
```json
{
  "id": "uuid",
  "username": "bob",
  "email": "bob@example.com",
  "role": "User",
  "isActive": true,
  "createdAt": "2026-03-14T10:00:00Z"
}
```

**Error responses**:

| Status | When |
|--------|------|
| `400` | Validation failure |
| `409` | Username or email already exists |

---

### PATCH /api/admin/users/{id}

Updates a user's role or active status. Partial update — only send fields to change.

**Request body**:
```json
{
  "role": "Admin",
  "isActive": false
}
```

**Response 200**: Updated user object (same shape as `GET /api/admin/users` item).

**Error responses**:

| Status | When |
|--------|------|
| `400` | Validation failure |
| `403` | Admin attempting to deactivate or remove their own admin role |
| `404` | User not found |

---

### DELETE /api/admin/users/{id}

Deletes a user account and all their data (cascade).

**Response 204**: No content.

**Error responses**:

| Status | When |
|--------|------|
| `403` | Admin attempting to delete their own account |
| `404` | User not found |

---

## Existing Endpoint Changes

All existing endpoints gain authentication enforcement. No shape changes.

| Endpoint | Change |
|----------|--------|
| `GET /api/entries` | Requires `Bearer` token; returns only current user's entries |
| `POST /api/entries` | Requires `Bearer` token; associates entry with current user |
| `DELETE /api/entries/{id}` | Requires `Bearer` token; 403 if entry belongs to another user |
| `DELETE /api/entries` | Requires `Bearer` token; deletes only current user's entries |
| `GET /api/chart` | Requires `Bearer` token; data scoped to current user |
| `GET /api/settings` | Requires `Bearer` token; settings scoped to current user |
| `PUT /api/settings` | Requires `Bearer` token; updates only current user's settings |
| `POST /api/migrate` | Requires `Bearer` token; migrates data into current user's account |
| `GET /api/health` | Unchanged; always public |
