# Data Model: Multi-User Support and Authentication

**Feature**: 005-jwt-multi-user-auth
**Date**: 2026-03-14

---

## Existing Entities (Modified)

### User *(extended)*

Current state: `User` has `Id`, `DisplayName`, `CreatedAt` — a minimal stub.

This feature extends `User` to support real authentication.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `Id` | `Guid` | PK | Unchanged |
| `Username` | `string` | NOT NULL, UNIQUE, max 100, case-insensitive index | Replaces `DisplayName`; used for login |
| `Email` | `string` | NOT NULL, UNIQUE, max 255 | Used for password reset |
| `PasswordHash` | `string` | NOT NULL, max 72 | bcrypt hash; plaintext never stored |
| `Role` | `enum UserRole` | NOT NULL | `Admin` or `User` |
| `IsActive` | `bool` | NOT NULL, default `true` | False = deactivated; cannot log in |
| `CreatedAt` | `DateTime` | NOT NULL | UTC; unchanged |

**Migration note**: The `DisplayName` column is dropped. The stub default user (`00000000-0000-0000-0000-000000000001`) is migrated: `Username = "default"`, no email, no password (the stub seeder and `StubCurrentUserResolver` are removed in this feature). Existing `WeightEntries` and `ChartSettings` rows retain their `UserId` FK; they will belong to the first admin account created via the first-run wizard or env-var bootstrap.

**Domain enum**:
```
UserRole { Admin, User }
```

---

## New Entities

### RefreshToken

Stores server-side refresh token records. Each record is single-use.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `Id` | `Guid` | PK | |
| `UserId` | `Guid` | FK → Users, NOT NULL | Cascade delete |
| `TokenHash` | `string` | NOT NULL, UNIQUE, max 64 | SHA-256 hex of the plaintext token |
| `ExpiresAt` | `DateTime` | NOT NULL | UTC; default 30 days from issue |
| `CreatedAt` | `DateTime` | NOT NULL | UTC |
| `IsUsed` | `bool` | NOT NULL, default `false` | Marked true on first successful exchange |
| `IsRevoked` | `bool` | NOT NULL, default `false` | Marked true on logout or admin revocation |

**Indexes**: `(UserId)`, `(TokenHash)` — both used on hot paths.

**Validation rules**:
- A token is valid only when: `IsUsed = false` AND `IsRevoked = false` AND `ExpiresAt > UtcNow` AND `User.IsActive = true`
- If a token presented is `IsUsed = true`: security event — revoke all tokens for that user and force re-login.

---

### PasswordResetToken

Stores password reset requests. Each token is single-use and expires after 1 hour.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `Id` | `Guid` | PK | |
| `UserId` | `Guid` | FK → Users, NOT NULL | Cascade delete |
| `TokenHash` | `string` | NOT NULL, UNIQUE, max 64 | SHA-256 hex of the plaintext token sent in email |
| `ExpiresAt` | `DateTime` | NOT NULL | UTC; `CreatedAt + 1 hour` |
| `CreatedAt` | `DateTime` | NOT NULL | UTC |
| `IsUsed` | `bool` | NOT NULL, default `false` | Marked true when password is reset |

**Indexes**: `(TokenHash)` — lookup path for reset completion.

**Rate limiting**: At most 1 active (unused, unexpired) reset token per user at a time. Creating a new request invalidates any prior unredeemed tokens for that user.

---

## Relationships

```
User (1) ──< WeightEntry (many)        [FK: WeightEntry.UserId, CASCADE DELETE]
User (1) ──< ChartSettings (1)         [FK: ChartSettings.UserId, CASCADE DELETE, UNIQUE]
User (1) ──< RefreshToken (many)       [FK: RefreshToken.UserId, CASCADE DELETE]
User (1) ──< PasswordResetToken (many) [FK: PasswordResetToken.UserId, CASCADE DELETE]
```

`WeightEntry.UserId` and `ChartSettings.UserId` already exist in the schema (spec 003). No FK migration needed — only the stub user row is removed.

---

## State Transitions

### User.IsActive

```
[created] → IsActive = true
           → (admin deactivates) → IsActive = false
                                  → (admin re-activates) → IsActive = true
           → (admin deletes) → row removed, all FKs cascade
```

When `IsActive = false`:
- Login rejected with HTTP 401
- All refresh tokens for the user are revoked immediately
- Existing access tokens are rejected on next server-side check

### RefreshToken lifecycle

```
[issued] → IsUsed=false, IsRevoked=false
         → (presented to /auth/refresh) → IsUsed=true, new token issued
         → (logout) → IsRevoked=true
         → (user deactivated) → IsRevoked=true
         → (replay detected — token already IsUsed) → ALL user tokens revoked
```

### PasswordResetToken lifecycle

```
[issued] → IsUsed=false, ExpiresAt = now+1h
         → (user sets new password) → IsUsed=true
         → (new reset requested) → prior token IsUsed=true (invalidated)
         → (expires without use) → token ignored on presentation
```

---

## Port Interfaces (Domain Layer)

New interfaces to be defined in `WeightTracker.Domain.Interfaces`:

**Repositories**:
- `IUserRepository` — extended with: `GetByUsernameAsync`, `GetByEmailAsync`, `ListAllAsync`, `UpdateAsync`, `DeleteAsync`, `AnyAsync`
- `IRefreshTokenRepository` — `AddAsync`, `GetByTokenHashAsync`, `MarkUsedAsync`, `RevokeAllForUserAsync`
- `IPasswordResetTokenRepository` — `AddAsync`, `GetByTokenHashAsync`, `MarkUsedAsync`, `InvalidatePriorTokensForUserAsync`

**Services**:
- `ITokenService` — `GenerateAccessToken(User)`, `GenerateRefreshToken()`, `HashToken(string)`, `ValidateAccessToken(string) → ClaimsPrincipal?`
- `IPasswordHasher` — `Hash(string plaintext) → string`, `Verify(string plaintext, string hash) → bool`
- `IEmailService` — `SendPasswordResetAsync(string toEmail, string resetLink) → Task`
- `IAuthService` — `LoginAsync(username, password)`, `RefreshAsync(tokenString)`, `LogoutAsync(tokenString)`, `RequestPasswordResetAsync(email)`, `ResetPasswordAsync(token, newPassword)`

**Modified**:
- `ICurrentUserResolver` — method signature unchanged (`GetCurrentUserId() → Guid`); implementation replaced from stub to JWT-based adapter.
