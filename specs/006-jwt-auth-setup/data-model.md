# Data Model: JWT Authentication and First-Run Setup

**Feature**: 006-jwt-auth-setup
**Date**: 2026-03-15

## Existing Entities (Modified)

### User *(modified)*

**Current state**: `Id`, `DisplayName`, `CreatedAt`
**After migration**: Adds auth fields; replaces `DisplayName` with `Username` + `Email`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `Id` | `Guid` | PK | UUID, unchanged |
| `Username` | `string` | NOT NULL, UNIQUE, max 100 | New — login identifier |
| `Email` | `string` | NOT NULL, UNIQUE, max 255 | New — contact address |
| `PasswordHash` | `string` | NOT NULL, max 60 | New — BCrypt hash (60 chars) |
| `Role` | `string` | NOT NULL, default `"user"`, max 20 | New — `"admin"` or `"user"` |
| `IsActive` | `bool` | NOT NULL, default `true` | New — soft-disable without delete |
| `CreatedAt` | `DateTime` | NOT NULL, UTC | Unchanged |

**Removed**: `DisplayName` (replaced by `Username`)

**Navigation**: `ICollection<RefreshToken> RefreshTokens`

**Indexes added**:
- `IX_Users_Username` (UNIQUE)
- `IX_Users_Email` (UNIQUE)

**Validation rules**:
- `Username`: 3–100 characters, alphanumeric + underscore + hyphen only
- `Email`: valid email format, max 255 characters
- `Password` (at registration): minimum 8 characters (hashed before storage)
- `Role`: must be one of `"admin"`, `"user"`

---

## New Entities

### RefreshToken *(new)*

Represents a server-side record of a long-lived session token. The raw token is sent to the client exactly once (in the login response cookie); only its SHA-256 hash is persisted.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `Id` | `Guid` | PK | UUID |
| `UserId` | `Guid` | NOT NULL, FK → Users.Id (CASCADE) | Owner of this token |
| `TokenHash` | `string` | NOT NULL, UNIQUE, max 64 | SHA-256 hex hash of raw token |
| `ExpiresAt` | `DateTime` | NOT NULL, UTC | 7 days from creation |
| `RevokedAt` | `DateTime?` | NULL = active, set on rotation/logout | UTC |
| `CreatedAt` | `DateTime` | NOT NULL, UTC | Token issue time |

**Indexes**:
- `IX_RefreshTokens_TokenHash` (UNIQUE) — token lookup on every refresh request
- `IX_RefreshTokens_UserId` — FK lookup, logout-all queries
- `IX_RefreshTokens_UserId_ExpiresAt` (composite) — cleanup of expired tokens

**State machine**:
```
Created (RevokedAt = null, ExpiresAt > now)
  → Rotated (RevokedAt set, replaced by new token)
  → Expired (ExpiresAt <= now — treated as invalid regardless of RevokedAt)
```

**Active token query**: `WHERE UserId = ? AND TokenHash = ? AND RevokedAt IS NULL AND ExpiresAt > NOW()`

---

## Migration Summary

### Migration name: `AddJwtAuthentication`

**Up actions** (in order):
1. `AlterTable("Users")` — add `Username`, `Email`, `PasswordHash`, `Role`, `IsActive` columns
2. `DropColumn("Users", "DisplayName")` — remove legacy column
3. `CreateTable("RefreshTokens")` — with all fields and constraints
4. `CreateIndex` × 3 on `RefreshTokens`
5. `CreateIndex` × 2 on `Users` (username/email unique)
6. `AddForeignKey` — `RefreshTokens.UserId → Users.Id` (cascade delete)
7. `Sql` — delete all `WeightEntries`, `ChartSettings`, `Users` with stub user ID `00000000-0000-0000-0000-000000000001`

**Down actions** (reverse):
1. Drop all new indexes and foreign key
2. `DropTable("RefreshTokens")`
3. Drop added `Users` columns; restore `DisplayName` as nullable
4. Re-insert stub user row

---

## Domain Interfaces (New)

### `IUserRepository` *(extended)*

Added methods:
- `GetByUsernameAsync(string username)` → `User?`
- `GetByIdAsync(Guid id)` → `User?` *(existing)*
- `AddAsync(User user)` → `User` *(existing)*
- `ExistsAnyAsync()` → `bool` (for first-run status check)

### `IRefreshTokenRepository` *(new)*

- `GetActiveByHashAsync(string tokenHash)` → `RefreshToken?`
- `AddAsync(RefreshToken token)` → `RefreshToken`
- `RevokeAsync(Guid tokenId)` → void
- `RevokeAllForUserAsync(Guid userId)` → void

### `ITokenService` *(new)*

- `GenerateTokensAsync(User user)` → `(string AccessToken, string RefreshToken)`
- `RenewAccessTokenAsync(Guid userId, string refreshToken)` → `string?`
- `InvalidateAllTokensAsync(Guid userId)` → void

### `IPasswordHasher` *(new)*

- `Hash(string password)` → `string`
- `Verify(string password, string hash)` → `bool`

---

## Frontend State Model (New Modules)

### `auth-token.ts` — In-memory access token store

```
Module state:
  _accessToken: string | null  (private, module-scoped)

Exports:
  setAccessToken(token: string): void
  getAccessToken(): string | null
  clearAccessToken(): void
```

### `auth-guard.ts` — Page routing guard

```
AuthState:
  isAuthenticated: boolean
  setupRequired: boolean
  error?: string

Exports:
  checkAuthStatus(): Promise<AuthState>
  enforceRedirect(pageType: "app" | "login" | "setup", state: AuthState): void
```

### Routing Logic

```
checkAuthStatus():
  1. GET /api/setup/status
     → firstRun: true  →  { isAuthenticated: false, setupRequired: true }
  2. POST /api/auth/refresh (credentials: "include")
     → 200  →  store token  →  { isAuthenticated: true, setupRequired: false }
     → non-200  →  { isAuthenticated: false, setupRequired: false }

enforceRedirect(pageType, state):
  "app"   + !authenticated + !setupRequired  → /login.html
  "app"   + !authenticated +  setupRequired  → /setup.html
  "login" +  authenticated                   → /index.html
  "login" +  setupRequired                   → /setup.html
  "setup" + !setupRequired                   → /login.html (or /index.html if authenticated)
  (no redirect in all other cases)
```
