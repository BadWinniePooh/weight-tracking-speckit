# Research: JWT Authentication and First-Run Setup

**Feature**: 006-jwt-auth-setup
**Date**: 2026-03-15

## Decision 1: JWT Library

**Decision**: `Microsoft.AspNetCore.Authentication.JwtBearer` v8.0.x (built-in)

**Rationale**: Native ASP.NET Core 8 integration, zero extra dependency overhead, full Minimal API support. Third-party alternatives (IdentityServer, OpenIddict) are overkill for a single-user personal app.

**Alternatives considered**: IdentityServer4 (deprecated), OpenIddict (complex), Duende IdentityServer (commercial license required)

---

## Decision 2: Password Hashing

**Decision**: `BCrypt.Net-Next` v4.x, work factor 12

**Rationale**: BCrypt is GPU-resistant due to Blowfish memory-hard design; PBKDF2 (Microsoft.AspNetCore.Cryptography.KeyDerivation) is vulnerable to GPU acceleration. Work factor 12 = ~250ms per hash — secure and acceptable UX. BCrypt includes its own salt; no separate salt storage needed.

**Alternatives considered**: PBKDF2 via `Microsoft.AspNetCore.Cryptography.KeyDerivation` (no new dependency, but weaker), Argon2 via `Konscious.Security.Cryptography` (stronger but adds dependency for marginal gain on a personal app)

---

## Decision 3: Refresh Token Storage Strategy

**Decision**: Server-side token rotation — store SHA-256 hash of each refresh token in a `RefreshTokens` table; rotate on every use (old token revoked, new token issued)

**Rationale**: Rotation is simpler than a revocation list (no separate blacklist table), naturally handles single-device use, and provides replay-attack detection (re-use of a revoked token flags potential compromise). SHA-256 hash storage means a database breach does not expose active sessions.

**Alternatives considered**: Stateless refresh token (no server-side storage — cannot revoke without key rotation), opaque token with revocation list (extra table, more complex queries)

---

## Decision 4: Access Token Lifetime

**Decision**: 15 minutes

**Rationale**: Industry standard. Short enough to limit exposure if intercepted; long enough that page interactions don't trigger constant silent renewals during normal use.

---

## Decision 5: Refresh Token Lifetime

**Decision**: 7 days (absolute, no idle extension)

**Rationale**: Standard for personal apps. Balances security (no indefinite sessions) with convenience (users don't re-login daily). After 7 days, silent renewal fails and the login screen is shown.

---

## Decision 6: JWT Claims (Minimal Set)

**Decision**: `sub` (user UUID), `jti` (token UUID), `iat`, `exp`, `iss` (`weight-tracker`), `aud` (`weight-tracker-api`)

**Rationale**: Minimal payload — no email/username/role in token. User details are looked up from the database via the `sub` claim on each request. Keeps token small and avoids stale-claim issues if user data changes.

**Alternatives considered**: Embed role/username in claims (simpler lookups but stale if user changes; unnecessary for single-user app)

---

## Decision 7: Refresh Token Cookie Settings

**Decision**: `HttpOnly=true`, `Secure=true`, `SameSite=Strict`, `Path=/`, `Expires=+7 days`

**Rationale**: HttpOnly prevents XSS scripts from reading the cookie. SameSite=Strict blocks CSRF (cookie not sent on cross-site navigations). Secure ensures HTTPS-only transmission. These three settings together provide defence-in-depth for the long-lived token.

---

## Decision 8: ITokenService Interface

**Decision**: Four methods on the Domain interface:
- `GenerateTokensAsync(User)` → `(accessToken: string, refreshToken: string)`
- `RenewAccessTokenAsync(userId, refreshTokenValue)` → `string?` (null = invalid/expired)
- `InvalidateAllTokensAsync(userId)` → void (logout)
- `IsRefreshTokenValidAsync(userId, refreshTokenValue)` → bool

**Rationale**: Minimal surface aligned to the three auth flows (login, refresh, logout) plus a standalone validator for guard logic.

---

## Decision 9: EF Core Migration Strategy

**Decision**: Single atomic migration `AddJwtAuthentication` that: adds columns to `Users`, creates `RefreshTokens` table, deletes stub user data via `MigrationBuilder.Sql()`.

**Rationale**: JWT auth is a cohesive feature; splitting into multiple migrations creates intermediate inconsistent states. EF Core migration transactions ensure atomicity. Stub user deletion (ID `00000000-0000-0000-0000-000000000001`) via raw SQL is the idiomatic EF Core pattern for data cleanup in migrations.

---

## Decision 10: RefreshTokens Indexes

**Decision**: Three indexes:
1. `IX_RefreshTokens_TokenHash` — unique; used for token lookup on every refresh request
2. `IX_RefreshTokens_UserId` — supports FK lookups and logout-all queries
3. `IX_RefreshTokens_UserId_ExpiresAt` — composite; optimises cleanup queries (`WHERE UserId = ? AND ExpiresAt < NOW()`)

---

## Decision 11: Frontend In-Memory Token Storage

**Decision**: Module-level closure in `auth-token.ts` — private variable with typed setter/getter/clear exports

**Rationale**: Simplest singleton pattern for a single-user app. Not stored in `localStorage` (XSS-readable), not in cookies (managed separately by browser for refresh token). Automatically cleared on page reload — silent refresh restores it.

---

## Decision 12: Frontend Silent Refresh (401 Retry)

**Decision**: Promise-based deduplication lock in the fetch wrapper — if a refresh is already in-flight, queue all concurrent 401s behind it; retry once after refresh; redirect to login on failure

**Rationale**: Prevents parallel refresh races (e.g., two simultaneous API calls both 401). One retry is sufficient — if still 401 after fresh token, the session is genuinely invalid.

---

## Decision 13: Multi-Page Vite Configuration

**Decision**: `rollupOptions.input` with three named entry points (`main`, `login`, `setup`) pointing to `src/index.html`, `src/login.html`, `src/setup.html`

**Rationale**: Native Vite/Rollup MPA pattern. Each page gets its own JS bundle. No SPA router needed. Login and setup pages load without pulling in the main app bundle.

---

## Decision 14: Shared Auth Guard Pattern

**Decision**: `auth-guard.ts` module with `checkAuthStatus()` (calls setup status + silent refresh) and `enforceRedirect()` (performs the redirect based on page type and auth state). Every entry file (`main.ts`, `login.ts`, `setup.ts`) calls this as its first action inside `DOMContentLoaded`.

**Rationale**: Avoids duplicating routing logic across three pages. Clear separation — guard checks state, page script renders content only after guard clears it.

---

## New NuGet Packages Required

| Package | Project | Purpose |
|---------|---------|---------|
| `Microsoft.AspNetCore.Authentication.JwtBearer` v8.0.x | `WeightTracker.Api` | JWT bearer middleware |
| `BCrypt.Net-Next` v4.x | `WeightTracker.Infrastructure` | Password hashing |

No new frontend npm packages required — standard `fetch()` API handles all auth flows.
