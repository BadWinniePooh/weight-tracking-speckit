# Implementation Plan: Multi-User Support and JWT Authentication

**Branch**: `005-jwt-multi-user-auth` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-jwt-multi-user-auth/spec.md`

## Summary

Replace the single-user stub with full multi-user authentication: JWT access tokens + httpOnly cookie refresh tokens, bcrypt password hashing, SMTP-based password reset, role-based access control (admin / user), admin bootstrap seeding, first-run wizard support, and per-user data isolation enforced server-side. All five user stories are delivered as independently testable slices ordered by priority. The backend uses Ports and Adapters throughout — all business logic in Domain/Infrastructure, zero logic in the API layer. The frontend gains a login page, password reset pages, and a first-run wizard page as separate Vite MPA entry points.

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend); TypeScript 5.x (frontend)
**Primary Dependencies**:
- `Microsoft.AspNetCore.Authentication.JwtBearer` 8.0.x — JWT middleware
- `System.IdentityModel.Tokens.Jwt` 8.x — token generation
- `BCrypt.Net-Next` 4.1.0+ — password hashing
- `MailKit` 4.x / `MimeKit` 4.x — SMTP email
- `Testcontainers.PostgreSql` — integration tests (existing)

**Storage**: PostgreSQL 16 via Docker named volume `weighttracker-data` (existing). New tables: `RefreshTokens`, `PasswordResetTokens`. `Users` table extended.

**Testing**: xUnit + WebApplicationFactory + Testcontainers.PostgreSql (all in `WeightTracker.Tests`). TDD mandatory.

**Target Platform**: Linux Docker container (ASP.NET Core); nginx:alpine (frontend)

**Performance Goals**: Login round trip < 500ms p95; token refresh < 200ms p95 (bcrypt verification is the bottleneck — work factor 12 targets ~200–300ms per hash on modest hardware)

**Constraints**: No self-registration; no provider-specific email code; all secrets via env vars; existing WeightEntry/ChartSettings data must not be lost during migration

**Scale/Scope**: Small multi-user deployment (single household / small team, <100 users). No horizontal scaling required.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|---------|
| **I. Specification-First** | ✅ PASS | `spec.md` complete with 5 user stories, 26 FRs, 7 measurable success criteria, all clarifications resolved |
| **II. Privacy & Data Ownership** | ✅ PASS | Passwords hashed (bcrypt, never logged); per-user data isolation enforced server-side; no third-party analytics; health data scoped to owner |
| **III. Test-First** | ✅ PASS | TDD is mandatory per CLAUDE.md and constitution; all tests in `WeightTracker.Tests`; failing tests written before implementation |
| **IV. Incremental Delivery** | ✅ PASS | 5 user stories ordered P1–P5; P1 (login) is a usable MVP; each story independently testable |
| **V. Simplicity (YAGNI)** | ✅ PASS | Using established libraries only (JwtBearer, BCrypt.Net-Next, MailKit); server-side refresh token store is required (cannot be avoided); no features beyond current spec |

**Post-design re-check**: ✅ All five principles satisfied. Complexity Tracking table below documents the three external dependencies added.

## Project Structure

### Documentation (this feature)

```text
specs/005-jwt-multi-user-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── WeightTracker.Domain/
│   ├── Entities/
│   │   ├── User.cs                          # Extended (Username, Email, PasswordHash, Role, IsActive)
│   │   ├── RefreshToken.cs                  # New
│   │   └── PasswordResetToken.cs            # New
│   └── Interfaces/
│       ├── Repositories/
│       │   ├── IUserRepository.cs           # Extended (GetByUsername, GetByEmail, List, Update, Delete, Any)
│       │   ├── IRefreshTokenRepository.cs   # New
│       │   └── IPasswordResetTokenRepository.cs # New
│       └── Services/
│           ├── ICurrentUserResolver.cs      # Unchanged (interface only; stub impl replaced)
│           ├── ITokenService.cs             # New
│           ├── IPasswordHasher.cs           # New
│           ├── IEmailService.cs             # New
│           └── IAuthService.cs              # New
│
├── WeightTracker.Infrastructure/
│   ├── Data/
│   │   ├── AppDbContext.cs                  # Extended (RefreshTokens, PasswordResetTokens DbSets)
│   │   └── Migrations/                      # New migration: AddAuthTables
│   ├── Repositories/
│   │   ├── UserRepository.cs                # Extended
│   │   ├── RefreshTokenRepository.cs        # New
│   │   └── PasswordResetTokenRepository.cs  # New
│   ├── Services/
│   │   ├── JwtTokenService.cs               # New (implements ITokenService)
│   │   ├── BcryptPasswordHasher.cs          # New (implements IPasswordHasher)
│   │   ├── SmtpEmailService.cs              # New (implements IEmailService)
│   │   ├── AuthService.cs                   # New (implements IAuthService)
│   │   ├── JwtCurrentUserResolver.cs        # New (replaces StubCurrentUserResolver)
│   │   └── StubCurrentUserResolver.cs       # Deleted
│   └── Seeding/
│       └── DatabaseSeeder.cs                # Updated (admin bootstrap; stub user seed removed)
│
├── WeightTracker.Api/
│   ├── Endpoints/
│   │   ├── AuthEndpoints.cs                 # New
│   │   └── UserManagementEndpoints.cs       # New
│   ├── Middleware/
│   │   └── CurrentUserMiddleware.cs         # Updated (reads from JWT ClaimsPrincipal)
│   └── Program.cs                           # Updated (JWT auth, CORS AllowCredentials, SMTP config)
│
└── WeightTracker.Tests/
    ├── Unit/
    │   ├── Services/
    │   │   ├── AuthServiceTests.cs          # New
    │   │   ├── JwtTokenServiceTests.cs      # New
    │   │   └── BcryptPasswordHasherTests.cs # New
    └── Integration/
        ├── Endpoints/
        │   ├── AuthEndpointsTests.cs        # New
        │   └── UserManagementEndpointsTests.cs # New
        └── Fixtures/
            └── ApiFixture.cs                # Updated (JWT config wired into test host)

frontend/
├── src/
│   ├── login.html                           # New page
│   ├── reset-request.html                   # New page
│   ├── reset-complete.html                  # New page
│   ├── setup.html                           # New first-run wizard page
│   └── ts/
│       ├── auth.ts                          # New (token store, refresh logic, race-condition guard)
│       ├── api-client.ts                    # Updated (auth headers, 401 interceptor)
│       ├── login.ts                         # New
│       ├── reset-request.ts                 # New
│       ├── reset-complete.ts                # New
│       └── setup.ts                         # New
└── vite.config.ts                           # Updated (MPA entry points for new pages)
```

**Structure Decision**: Web application — Option 2. `backend/` + `frontend/` follow the existing project layout established in spec 004. No new top-level directories introduced.

## Complexity Tracking

| Complexity | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `BCrypt.Net-Next` external dependency | .NET stdlib has no bcrypt implementation; PBKDF2 requires manual salt management and produces a lower-quality developer experience | `Rfc2898DeriveBytes` (PBKDF2) is viable but requires explicit salt generation, serialization, and iteration-count storage — more code, same security. BCrypt's self-describing hash format is simpler and better-understood. |
| `MailKit` external dependency | `System.Net.Mail.SmtpClient` is officially deprecated by Microsoft; has blocking async and poor SMTP compliance | SmtpClient is the only alternative in stdlib. Using it would create known technical debt immediately. |
| Server-side `RefreshTokens` table | Required to enable single-use enforcement, logout, and revocation-on-deactivation; stateless refresh tokens cannot be revoked | A purely stateless JWT-based refresh would not allow logout or immediate revocation when an admin deactivates a user — violating FR-008 and FR-013. |
