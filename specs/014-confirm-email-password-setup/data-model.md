# Data Model: Confirm Email → Password Setup Redirect

**Feature**: `014-confirm-email-password-setup`
**Date**: 2026-03-18

## Entities Involved

No new entities are introduced. Two existing entities are involved:

### PasswordResetToken (existing — no schema change)

| Field       | Type        | Description |
|-------------|-------------|-------------|
| `Id`        | Guid        | Primary key |
| `UserId`    | Guid        | FK to User  |
| `TokenHash` | string      | SHA256 hash of the plaintext token |
| `ExpiresAt` | DateTime    | 1 hour from creation |
| `CreatedAt` | DateTime    | UTC now     |
| `UsedAt`    | DateTime?   | Set when token is consumed |

This record is created by the confirm-email endpoint (via `CreateResetTokenAsync`) when email confirmation succeeds. It is consumed by the existing password reset (`POST /api/auth/reset-password`) flow.

### User (existing — no schema change)

`EmailConfirmed` is set to `true` by `EmailConfirmationService.ConfirmAsync` as before. No new fields.

## Interface Changes (not schema changes)

Two interface signatures are amended:

### `IEmailConfirmationService.ConfirmAsync`

| Before | After |
|--------|-------|
| `Task<bool> ConfirmAsync(string token)` | `Task<Guid?> ConfirmAsync(string token)` |

Returns the confirmed user's `Id` on success; `null` on failure.

### `IPasswordResetService` — new method

```
Task<string> CreateResetTokenAsync(Guid userId)
```

Creates and persists a `PasswordResetToken` for the given user and returns the URL-safe Base64 plaintext token. Does NOT send any email.

## No Persistent State Changes

- No new database tables
- No schema migrations
- No changes to existing columns
- No localStorage or session changes in the frontend
