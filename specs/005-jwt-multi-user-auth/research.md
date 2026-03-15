# Research: Multi-User Support and JWT Authentication

**Feature**: 005-jwt-multi-user-auth
**Date**: 2026-03-14

---

## Decision 1: JWT Library (.NET 8)

**Decision**: Use `Microsoft.AspNetCore.Authentication.JwtBearer` (8.0.x) for middleware pipeline + `System.IdentityModel.Tokens.Jwt` (8.x) for token generation and validation.

**Rationale**: These are the canonical Microsoft packages for JWT in ASP.NET Core. JwtBearer integrates directly into the authentication middleware pipeline (`UseAuthentication()`) and handles bearer token extraction from `Authorization` headers automatically. No third-party library needed.

**Alternatives considered**:
- `Microsoft.IdentityModel.JsonWebTokens` — newer, faster API; viable but less widely documented for Minimal API middleware wiring. Can be adopted in a future iteration.

**NuGet packages**:
- `Microsoft.AspNetCore.Authentication.JwtBearer` 8.0.x
- `System.IdentityModel.Tokens.Jwt` 8.x (transitive, referenced explicitly for token creation)

**Configuration**: JWT secret sourced from `JWT_SECRET` env var. Token issuer and audience sourced from `JWT_ISSUER` and `JWT_AUDIENCE` env vars. Consistent with the project's all-env-vars configuration style (see `DB_HOST`, `AllowedOrigin`).

---

## Decision 2: Password Hashing

**Decision**: `BCrypt.Net-Next` (v4.1.0+).

**Rationale**: BCrypt is the industry standard for password hashing in .NET applications that do not require Argon2's memory-hardness guarantees. It includes automatic salt generation, adaptive work factor, and produces a self-describing hash string (`$2a$...`). The standard library (`System.Security.Cryptography`) does not provide bcrypt; it provides PBKDF2 via `Rfc2898DeriveBytes`, which is acceptable but less idiomatic for this stack.

**Alternatives considered**:
- PBKDF2 (`Rfc2898DeriveBytes`) — no external dependency, but more boilerplate for salt storage and work-factor management. Rejected in favor of simpler bcrypt API.
- Argon2 via `Isopoh.Cryptography.Argon2` — superior for high-security contexts; unnecessary complexity for a self-hosted personal health app.

**Complexity justification**: External dependency required because the .NET standard library has no bcrypt implementation.

---

## Decision 3: SMTP Email

**Decision**: `MailKit` (v4.x) with `MimeKit` (v4.x).

**Rationale**: Microsoft explicitly marks `System.Net.Mail.SmtpClient` as poorly designed and recommends against it for new code. `SmtpClient` has a blocking async implementation and poor connection management. MailKit is fully async, provider-agnostic, supports any SMTP server (including STARTTLS, SSL, port 465/587/25), and is part of the .NET Foundation. It is the de facto standard for SMTP in .NET.

**Alternatives considered**:
- `System.Net.Mail.SmtpClient` — rejected per Microsoft guidance; poor async support.
- Provider SDKs (SendGrid, Mailgun, etc.) — rejected explicitly by spec (no provider-specific code).

**SMTP configuration env vars** (all required at runtime when password reset is enabled):
- `SMTP_HOST` — hostname of the SMTP server
- `SMTP_PORT` — port number (typically 465 for SSL, 587 for STARTTLS)
- `SMTP_USER` — SMTP authentication username
- `SMTP_PASSWORD` — SMTP authentication password
- `SMTP_SENDER_EMAIL` — from address on outgoing emails

**Behaviour when unconfigured**: The password reset endpoint returns HTTP 503 with a clear error. The frontend hides the "Forgot password?" link when the backend reports SMTP is not configured (detected via `GET /api/auth/config`).

---

## Decision 4: Refresh Token Storage

**Decision**: Store refresh tokens server-side in PostgreSQL via EF Core. Each token record is single-use and carries an expiry timestamp.

**Rationale**: HttpOnly cookies carry the token string to the browser, but the server must maintain authority over validity. Server-side storage enables:
- Single-use enforcement (token is marked used on first exchange)
- Immediate invalidation on logout or account deactivation
- Detection of token replay (if a used token is presented again, invalidate all tokens for that user)

**Token rotation**: On every successful `/auth/refresh` call, the presented refresh token is invalidated and a new one is issued. This limits the blast radius if a refresh token is compromised.

**Schema**: `RefreshTokens` table — columns: `Id` (GUID PK), `UserId` (FK → Users), `TokenHash` (SHA-256 of the token string, stored instead of plaintext), `ExpiresAt`, `CreatedAt`, `IsUsed`, `IsRevoked`. The plaintext token is returned to the browser once and never stored on the server.

**Rationale for hashing**: If the DB is compromised, hashed tokens cannot be replayed directly.

---

## Decision 5: Frontend Token Storage

**Decision**: Access token stored in memory (module-level variable). Refresh token stored in HttpOnly, Secure, SameSite=Strict cookie (managed by the browser/backend).

**Rationale**:
- Memory storage prevents XSS theft of the access token (JavaScript cannot access another module's variable via injected script).
- HttpOnly cookie prevents XSS theft of the refresh token.
- SameSite=Strict prevents CSRF.
- The access token is lost on page reload, but is recovered transparently by calling `/auth/refresh` (which sends the cookie automatically).

**Alternatives considered**:
- `localStorage` — rejected; readable by any JavaScript on the page, including injected scripts.
- `sessionStorage` — same XSS exposure as localStorage.

---

## Decision 6: Concurrent Refresh Race Condition

**Decision**: Client-side deduplication via a single shared promise. When multiple concurrent requests receive a 401, only one refresh call is made; all callers await the same promise and retry with the new token.

**Pattern** (pseudocode):
```
if (refreshInProgress) {
    await refreshPromise
} else {
    refreshPromise = callRefreshEndpoint()
    await refreshPromise
}
```

**Rationale**: Prevents multiple simultaneous `/auth/refresh` calls (which would all try to exchange the same refresh token, causing all but the first to fail with a replay error). No external library needed — a module-level boolean + Promise variable is sufficient.

---

## Decision 7: First-Run Mode Detection

**Decision**: `GET /api/auth/status` returns a JSON object with `{ firstRun: bool, smtpConfigured: bool }`. This endpoint is always public (no auth required).

**Rationale**: The frontend needs two pieces of boot-time information: (1) whether to show the first-run wizard or the login page, and (2) whether to show the "Forgot password?" link. Combining them into a single status call avoids two round trips on startup.

**Security**: The endpoint reveals no sensitive information — it only tells the client whether zero users exist and whether SMTP is wired up.

---

## Decision 8: Frontend Page Architecture

**Decision**: Add new HTML entry points alongside the existing `index.html`. Vite's multi-page app (MPA) mode supports multiple `input` entries in `vite.config.ts`.

**New pages**:
- `frontend/src/login.html` + `frontend/src/ts/login.ts`
- `frontend/src/reset-request.html` + `frontend/src/ts/reset-request.ts`
- `frontend/src/reset-complete.html` + `frontend/src/ts/reset-complete.ts`
- `frontend/src/setup.html` + `frontend/src/ts/setup.ts`

**Rationale**: Separate HTML files are the simplest approach in a Vite MPA project with no router. Each page is a standalone entry point. No SPA router library is introduced (YAGNI — no current story requires client-side routing beyond these four pages).

---

## Decision 9: Password Minimum Complexity

**Decision**: Minimum 8 characters. No other forced complexity rules (no mandatory symbols, no mixed case requirement).

**Rationale**: NIST SP 800-63B (2024 revision) recommends minimum length (≥8) and rejection of commonly-used passwords, but explicitly advises against mandatory complexity rules (which reduce usability without improving security). Common-password rejection (optional, future) can be added later without breaking changes.

---

## Decision 10: Admin Bootstrap vs First-Run Wizard Precedence

**Decision**: If `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` env vars are all set, the admin account is created at startup and the first-run wizard is never shown. The wizard is only shown when those env vars are absent **and** no users exist. If only some env vars are set (partial configuration), the app logs a warning and starts in first-run mode (the partial vars are ignored).

**Rationale**: Partial env var configuration is likely a misconfiguration rather than intent. Failing fast with a log warning is safer than silently skipping the seed.
