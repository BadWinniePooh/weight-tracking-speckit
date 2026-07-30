# API Contract: Confirm Email → Password Setup

**Feature**: `014-confirm-email-password-setup`
**Date**: 2026-03-18

## Amended Endpoint

### GET /api/auth/confirm-email

**Location**: `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`

**Change**: Success response body is extended to include `passwordResetToken`.

#### Request (unchanged)

```
GET /api/auth/confirm-email?token=<url-encoded-confirmation-token>
```

#### Responses

**Success (200 OK) — AMENDED**

```json
{
  "message": "Email confirmed. You may now log in.",
  "passwordResetToken": "<url-safe-base64-plaintext-reset-token>"
}
```

- `message`: unchanged from current implementation
- `passwordResetToken`: a newly generated, single-use password reset token valid for 1 hour

**Failure (400 Bad Request) — unchanged**

```json
{
  "error": "This confirmation link is invalid or has expired."
}
```

---

## Amended Frontend API Client

### `confirmEmail(token: string)`

**Location**: `frontend/src/ts/api-client.ts`

**Change**: Return type changes from `Promise<void>` to `Promise<ConfirmEmailResponse>`.

```typescript
export interface ConfirmEmailResponse {
  message: string;
  passwordResetToken: string;
}

export async function confirmEmail(token: string): Promise<ConfirmEmailResponse> {
  return request<ConfirmEmailResponse>(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`);
}
```

---

## Amended Internal Interfaces

### `IEmailConfirmationService.ConfirmAsync`

**Location**: `backend/WeightTracker.Domain/Interfaces/Services/IEmailConfirmationService.cs`

| Before | After |
|--------|-------|
| `Task<bool> ConfirmAsync(string token)` | `Task<Guid?> ConfirmAsync(string token)` |

Returns the confirmed user's `Id` on success, `null` on failure.

### `IPasswordResetService` — new method

**Location**: `backend/WeightTracker.Domain/Interfaces/Services/IPasswordResetService.cs`

```csharp
Task<string> CreateResetTokenAsync(Guid userId);
```

Creates and persists a `PasswordResetToken` for the user; returns the URL-safe Base64 plaintext token without sending any email.

---

## Frontend Page Behaviour Change

### `initConfirmEmailPage()` success path

**Location**: `frontend/src/ts/confirm-email.ts`

| Before | After |
|--------|-------|
| Hide loading panel; show `#success-panel` | Redirect to `/reset-complete.html?token=<passwordResetToken>` |

The `#success-panel` is no longer shown. The redirect is immediate on receiving the successful API response. If the response is missing `passwordResetToken`, this is treated as an error (same as FR-006 in spec).
