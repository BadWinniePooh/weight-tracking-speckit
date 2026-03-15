# Research: Admin & User Management with Email Infrastructure

**Feature**: 007-admin-user-management
**Date**: 2026-03-15
**Status**: Complete — all decisions resolved

---

## Decision 1: SMTP Client Library

**Decision**: Use **MailKit** (`MailKit` + `MimeKit` NuGet packages) for SMTP sending.

**Rationale**: `System.Net.Mail.SmtpClient` is marked as "not recommended for new development" in .NET 6+ docs (GitHub issue dotnet/runtime#17796 recommends MailKit). MailKit has full RFC 5321 support, SSL/TLS negotiation options, and is actively maintained. It is the de facto community standard for .NET SMTP.

**Alternatives considered**:
- `System.Net.Mail.SmtpClient` — built-in, but deprecated, lacks STARTTLS negotiation on modern .NET, does not support async properly
- FluentEmail — adds an additional abstraction layer with no benefit over MailKit directly; violates YAGNI

**Implementation note**: `SmtpEmailService` in `WeightTracker.Infrastructure/Services/` wraps MailKit. Configuration from `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SENDER_EMAIL` env vars. `IEmailService` (Domain port) defines a single `SendAsync(to, subject, body)` method.

---

## Decision 2: Token Generation and Storage Pattern

**Decision**: Generate tokens using **`RandomNumberGenerator.GetBytes(32)`** (cryptographically secure, 256-bit entropy), base64url-encode for URL safety, store SHA-256 hash in the database. Send plaintext token in the email link.

**Rationale**: Mirrors the existing `RefreshToken` security model in this codebase (SHA-256 hash stored, plaintext sent to client). Ensures tokens cannot be recovered from a database breach. Base64url encoding avoids URL encoding issues.

**Alternatives considered**:
- GUID tokens — insufficient entropy (122 bits), predictable structure
- JWT-based reset tokens — adds complexity; self-contained tokens cannot be invalidated server-side without a revocation store, defeating single-use requirement

---

## Decision 3: App Base URL for Email Links

**Decision**: Use **`APP_BASE_URL`** environment variable (e.g., `https://app.example.com`) to construct reset and confirmation links.

**Rationale**: Using the request `Host` header is fragile in reverse-proxy deployments (the backend may see an internal hostname). An explicit env var is the standard production practice and is easily testable.

**Format**:
- Reset link: `{APP_BASE_URL}/reset-password.html?token={token}`
- Confirmation link: `{APP_BASE_URL}/confirm-email.html?token={token}`

**In tests**: `ApiFixture` sets `APP_BASE_URL=http://localhost:3000` via `UseSetting`.

---

## Decision 4: MailHog Test Container Integration

**Decision**: Add MailHog as a **Testcontainers generic container** (`DotNet.Testcontainers` `GenericContainer`) alongside the existing PostgreSQL container in `ApiFixture`.

**Rationale**: MailHog is the standard SMTP stub for .NET integration testing. The `Testcontainers` package already used for PostgreSQL (`Testcontainers.PostgreSql` 3.10.0) has a `GenericContainerBuilder` that supports any Docker image. MailHog's HTTP API (`GET /api/v2/messages`) enables programmatic assertion of email delivery without parsing email files.

**Container config**:
- Image: `mailhog/mailhog:latest`
- SMTP port: 1025 (map to dynamic host port)
- HTTP API port: 8025 (map to dynamic host port)
- `ApiFixture` injects `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` (empty), `SMTP_PASSWORD` (empty), `SMTP_SENDER_EMAIL` (`test@example.com`) via `UseSetting`

**Test assertion pattern**: `GET http://localhost:{mailhogHttpPort}/api/v2/messages` returns JSON array; tests assert `to[0].Mailbox + "@" + to[0].Domain`, `Content.Headers.Subject`, and body contains the token URL.

---

## Decision 5: Admin Role Enforcement

**Decision**: Admin authorization uses a custom **`[Authorize(Policy = "AdminOnly")]`** policy backed by a JWT claim check. The `Role` claim is included in the JWT at login time.

**Rationale**: Existing JWT infrastructure already issues role claims. Adding a named policy is the minimal addition over raw claim inspection. No additional middleware required.

**Implementation**: In `Program.cs`, add `builder.Services.AddAuthorization(o => o.AddPolicy("AdminOnly", p => p.RequireClaim("role", "admin")))`. Endpoint groups use `.RequireAuthorization("AdminOnly")`. The JWT token generation in `JwtTokenService` must include the user's `Role` as a `"role"` claim.

---

## Decision 6: IUserManagementService Scope

**Decision**: `IUserManagementService` is a **Domain port** that encapsulates create-user, deactivate, reactivate, immediate-delete, and assign-role operations. It orchestrates `IUserRepository`, `IEmailConfirmationService`, `IAuditLogRepository`, and enforces the "cannot act on own account" constraint.

**Rationale**: Keeps business rules (self-action guard, grace period scheduling, audit log write) in a single service rather than scattered across endpoints. Endpoints remain thin.

---

## Decision 7: User Deletion Background Service Pattern

**Decision**: `UserDeletionHostedService` implements `IHostedService` (via `BackgroundService`) and is registered via `builder.Services.AddHostedService<UserDeletionHostedService>()`. It reads `USER_DELETION_GRACE_DAYS` from configuration (default 30).

**Domain port**: `IUserDeletionService` with `DeleteExpiredUsersAsync(CancellationToken)`.
**Infrastructure adapter**: `UserDeletionHostedService` calls `IUserDeletionService` on startup and every 24 hours.

**Rationale**: `BackgroundService` is the idiomatic .NET hosted service base class. Separating `IUserDeletionService` (testable without hosting) from `UserDeletionHostedService` (the scheduler) allows unit testing the deletion logic in isolation.

---

## Decision 8: Audit Log Append-Only Enforcement

**Decision**: `AuditLogEntry` has no EF Core `Update` or `Delete` operations. The `IAuditLogRepository` exposes only `AppendAsync(entry)` and `QueryAsync(filter)`. No `Delete` or `Update` methods exist on the interface.

**Rationale**: Prevents accidental or intentional deletion via application code. Database-level enforcement (revoke DELETE/UPDATE on the table) is a deployment concern documented in quickstart.md.

---

## Decision 9: Pending Email Change Storage

**Decision**: Store `PendingEmail` as a **nullable column on the `Users` table** rather than a separate table.

**Rationale**: A user can have at most one pending email change at a time (spec assumption). A nullable column is the simplest representation. The `EmailConfirmationToken` table links to both user ID and the target email, so the token carries the intended new address even if `PendingEmail` is queried independently.

---

## Decision 10: Frontend Scope (this iteration)

**Decision**: Frontend changes are **limited to `api-client.ts` only** — no new HTML pages or UI components.

New typed functions added to `api-client.ts`:
- `requestPasswordReset(email)`
- `resetPassword(token, newPassword)`
- `confirmEmail(token)`
- `changeUsername(newUsername)`
- `changePassword(currentPassword, newPassword)`
- `changeEmail(newEmail)`
- `adminListUsers()`
- `adminCreateUser(username, email, role)`
- `adminDeactivateUser(id)`
- `adminReactivateUser(id)`
- `adminDeleteUser(id)`
- `adminAssignRole(id, role)`
- `adminResendConfirmation(id)`
- `adminGetAuditLog(params: {page, pageSize, fromDate?, toDate?, actionType?})`

All UI pages (admin dashboard, password reset form, email confirmation page) are deferred to the next iteration (008).

---

## Dependencies Added

| Package | Project | Version | Reason |
|---------|---------|---------|--------|
| `MailKit` | Infrastructure | 4.x (latest stable) | SMTP sending |
| `MimeKit` | Infrastructure | 4.x (latest stable) | Email message construction (transitive dep of MailKit but explicit for clarity) |
| `Testcontainers` | Tests | 3.10.0 (match existing) | MailHog generic container |
