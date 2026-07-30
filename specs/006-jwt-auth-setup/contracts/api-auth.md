# API Contracts: Authentication and First-Run Setup

**Feature**: 006-jwt-auth-setup
**Date**: 2026-03-15

All existing endpoints (`/api/entries`, `/api/chart`, `/api/settings`, `/api/migrate`) require a valid `Authorization: Bearer <token>` header and return `401 Unauthorized` if missing or invalid. The endpoints below are new.

---

## Public Endpoints (No JWT Required)

### GET /api/setup/status

Reports whether first-run setup is required.

**Request**: No body, no auth header required.

**Response 200 OK**:
```json
{ "firstRun": true }
```
or
```json
{ "firstRun": false }
```

`firstRun: true` means no user accounts exist and the setup wizard must be completed before login is possible.

---

### POST /api/setup/initialize

Creates the first admin account. Rejected if any user already exists.

**Request body**:
```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "secretpass123"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `username` | string | yes | 3–100 chars, alphanumeric + `_` + `-` |
| `email` | string | yes | valid email format, max 255 chars |
| `password` | string | yes | minimum 8 characters |

**Response 201 Created**:
```json
{ "message": "Setup complete. Please log in." }
```

**Response 409 Conflict** (user already exists):
```json
{ "error": "Setup has already been completed." }
```

**Response 400 Bad Request** (validation failure):
```json
{
  "errors": {
    "username": ["Username must be at least 3 characters."],
    "password": ["Password must be at least 8 characters."]
  }
}
```

---

## Authentication Endpoints (No JWT Required)

### POST /api/auth/login

Authenticates a user and establishes a session.

**Request body**:
```json
{
  "username": "admin",
  "password": "secretpass123"
}
```

**Response 200 OK**:
```json
{
  "accessToken": "<jwt>",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

Sets `Set-Cookie: refreshToken=<opaque>; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=<+7 days>`

**Response 401 Unauthorized** (wrong credentials):
```json
{ "error": "Invalid username or password." }
```

**Notes**:
- The same error message is returned whether username or password is wrong (prevents username enumeration).
- The `accessToken` must be stored in memory by the frontend and included in `Authorization: Bearer` on all subsequent protected API calls.
- The refresh token is set as an `HttpOnly` cookie — the frontend does not read or manage it directly.

---

### POST /api/auth/refresh

Exchanges a valid refresh token cookie for a new access token. Called silently by the frontend on page load and after 401 responses.

**Request**: No body. Refresh token is sent automatically via cookie (`credentials: "include"` required on the fetch call).

**Response 200 OK**:
```json
{
  "accessToken": "<new-jwt>",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

Sets a new `Set-Cookie: refreshToken=...` (rotating the token — old cookie is replaced).

**Response 401 Unauthorized** (missing, expired, or revoked refresh token):
```json
{ "error": "Session expired. Please log in again." }
```

Clears the `refreshToken` cookie on 401.

---

### POST /api/auth/logout

Invalidates the current session server-side and clears the refresh token cookie.

**Request**: No body. Requires `Authorization: Bearer <token>` header.

**Response 204 No Content**: Session invalidated.

Sets `Set-Cookie: refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=<epoch>` (clears the cookie).

**Notes**: After logout, the frontend must clear the in-memory access token and redirect to `/login.html`.

---

## Protected Endpoint Changes

All existing endpoints now require `Authorization: Bearer <token>`.

**Existing endpoints** (`/api/entries`, `/api/chart`, `/api/settings`, `/api/migrate`, `/api/health`):

| Scenario | Response |
|----------|----------|
| Header present, token valid | Existing response (unchanged) |
| Header missing | `401 Unauthorized` |
| Header present, token expired | `401 Unauthorized` |
| Header present, token invalid (bad signature, wrong issuer) | `401 Unauthorized` |

The `401` body for protected endpoints:
```json
{ "error": "Authentication required." }
```

---

## CORS Requirements

All endpoints that accept `credentials: "include"` fetch calls require:
- `Access-Control-Allow-Origin: <explicit-origin>` (from `ALLOWED_ORIGIN` env var — no wildcard)
- `Access-Control-Allow-Credentials: true`

The backend must **not** use `AllowAnyOrigin()` in combination with `AllowCredentials()`.
