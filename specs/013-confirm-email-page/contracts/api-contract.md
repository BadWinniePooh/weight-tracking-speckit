# API Contract: Email Confirmation

**Feature**: `013-confirm-email-page`
**Date**: 2026-03-18

## Consumed Endpoint

This feature consumes one existing backend endpoint. **No backend changes are required.**

---

### GET /api/auth/confirm-email

**Purpose**: Validates an email confirmation token and marks the user's email as confirmed.

**Called by**: `confirmEmail(token)` in `frontend/src/ts/api-client.ts`

**Request**:

```
GET /api/auth/confirm-email?token=<url-encoded-token>
```

| Parameter | Location    | Type   | Required | Notes                        |
|-----------|-------------|--------|----------|------------------------------|
| `token`   | Query string | string | Yes      | URL-encoded confirmation token |

**Responses**:

| Status | Meaning                                        | Frontend Action              |
|--------|------------------------------------------------|------------------------------|
| 200 OK | Token is valid; email confirmed successfully   | Show success panel           |
| 400    | Token is invalid, expired, or already used     | Show error panel             |
| 404    | Token not found                                | Show error panel             |

**Error body**: Not relied upon by the frontend — the page shows a static error message for all non-2xx responses.

---

## Frontend Module Contract

### `initConfirmEmailPage(): Promise<void>`

Exported from `frontend/src/ts/confirm-email.ts`.

**Behaviour**:
1. Calls `initTheme()`, `await loadConfig()`, `await checkAuthStatus()`, `enforceRedirect("public", state)`
2. Reads `token` from `window.location.search`
3. If token is absent or empty: removes `hidden` from `#error-panel`, sets `#error-message` to missing-token message, returns immediately
4. If token is present: removes `hidden` from `#loading-panel`, calls `await confirmEmail(token)`
5. On success: hides `#loading-panel`, removes `hidden` from `#success-panel`
6. On error: hides `#loading-panel`, removes `hidden` from `#error-panel`, sets `#error-message` to API error message

**Called by**: `document.addEventListener("DOMContentLoaded", ...)` in the same module
