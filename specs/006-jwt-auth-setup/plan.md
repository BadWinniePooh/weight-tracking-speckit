# Implementation Plan: JWT Authentication and First-Run Setup

**Branch**: `006-jwt-auth-setup` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/006-jwt-auth-setup/spec.md`

## Summary

Introduce JWT-based authentication (username/password login, short-lived access tokens, httpOnly refresh token cookies, server-side token rotation) and a first-run setup wizard (one-time admin account creation, automated seeding via env vars). All existing weight entry/chart/settings endpoints gain JWT protection. Frontend gains two new pages (login, setup) plus a shared routing guard that every page runs before rendering.

The stub user account (ID `00000000-0000-0000-0000-000000000001`) and all its associated data are removed via an EF Core migration.

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend); TypeScript 5.x / ES2020 (frontend)
**Primary Dependencies**:
- Backend (new): `Microsoft.AspNetCore.Authentication.JwtBearer` v8.0.x, `BCrypt.Net-Next` v4.x
- Backend (existing): EF Core 8, Npgsql 8, xUnit, Testcontainers.PostgreSql
- Frontend (no new packages): Vite 5, Vitest 2, Chart.js 4, standard fetch API
**Storage**: PostgreSQL 16 — adds `RefreshTokens` table; alters `Users` table
**Testing**: xUnit + WebApplicationFactory + Testcontainers.PostgreSql (backend); Vitest + jsdom (frontend)
**Target Platform**: Docker Compose — Linux container for backend, nginx:alpine for frontend
**Performance Goals**: Login response < 1s; silent refresh < 200ms; BCrypt hash ~250ms (work factor 12)
**Constraints**: No wildcard CORS with credentials; access token in memory only (not localStorage); single atomic DB migration
**Scale/Scope**: Single-user personal app; one active refresh token per user at any time

## Constitution Check

*GATE: Must pass before implementation starts.*

### I. Specification-First ✅
`spec.md` completed and validated before this plan was written. All user stories have acceptance scenarios and measurable success criteria.

### II. Privacy & Data Ownership ✅
- Passwords stored only as BCrypt hashes — never in plaintext
- Access tokens stored in JS memory only (not localStorage/cookies)
- Refresh tokens stored as SHA-256 hash server-side — raw token never persisted
- HttpOnly + SameSite=Strict cookie prevents XSS and CSRF token theft
- No personal health data transmitted to third parties (unchanged)
- Existing privacy standards for weight entries unchanged

### III. Test-First (NON-NEGOTIABLE) ✅
TDD mandatory throughout. Every implementation task is paired with a failing test written first. All tests live in `WeightTracker.Tests`. Frontend tests in `tests/`.

### IV. Incremental Delivery (MVP First) ✅
P1 (first-run setup) is independently testable with a fresh DB. P2 (login) depends on P1 but delivers complete auth flow. P3 (session continuity) builds on P2. Each phase is demonstrable independently.

### V. Simplicity (YAGNI) ✅
No abstractions beyond current requirements. See Complexity Tracking for justified deviations.

## Project Structure

### Documentation (this feature)

```text
specs/006-jwt-auth-setup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   ├── api-auth.md      # HTTP endpoint contracts
│   └── frontend-modules.md  # TS module contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
  WeightTracker.Domain/
    Entities/
      User.cs                  # MODIFY: add Username, Email, PasswordHash, Role, IsActive; remove DisplayName
      RefreshToken.cs          # NEW
      WeightEntry.cs           # unchanged
      ChartSettings.cs         # unchanged
    Interfaces/
      Repositories/
        IUserRepository.cs     # MODIFY: add GetByUsernameAsync, ExistsAnyAsync
        IRefreshTokenRepository.cs  # NEW
      Services/
        ICurrentUserResolver.cs  # unchanged (interface only)
        ITokenService.cs         # NEW
        IPasswordHasher.cs       # NEW
  WeightTracker.Infrastructure/
    Data/
      AppDbContext.cs           # MODIFY: add RefreshTokens DbSet, update User config, add RefreshToken config
      Migrations/
        <timestamp>_AddJwtAuthentication.cs   # NEW (generated + customised)
    Repositories/
      UserRepository.cs         # MODIFY: add GetByUsernameAsync, ExistsAnyAsync
      RefreshTokenRepository.cs # NEW
    Services/
      JwtTokenService.cs        # NEW (replaces StubCurrentUserResolver logic)
      BcryptPasswordHasher.cs   # NEW
      JwtCurrentUserResolver.cs # NEW (replaces StubCurrentUserResolver)
      StubCurrentUserResolver.cs  # DELETE
    Seeding/
      DatabaseSeeder.cs         # MODIFY: remove stub user seed; add env-var admin seed
  WeightTracker.Api/
    Endpoints/
      AuthEndpoints.cs          # NEW: POST /api/auth/login, /refresh, /logout
      SetupEndpoints.cs         # NEW: GET /api/setup/status, POST /api/setup/initialize
      EntryEndpoints.cs         # MODIFY: require auth
      ChartEndpoints.cs         # MODIFY: require auth
      SettingsEndpoints.cs      # MODIFY: require auth
      MigrationEndpoints.cs     # MODIFY: require auth
    Middleware/
      CurrentUserMiddleware.cs  # MODIFY: read user ID from JWT claims instead of stub resolver
    Program.cs                  # MODIFY: add JWT auth config, CORS credentials, new DI registrations
  WeightTracker.Tests/
    Unit/
      Services/
        JwtTokenServiceTests.cs    # NEW
        BcryptPasswordHasherTests.cs  # NEW
    Integration/
      Endpoints/
        AuthEndpointsTests.cs       # NEW
        SetupEndpointsTests.cs      # NEW
      Repositories/
        RefreshTokenRepositoryTests.cs  # NEW
        UserRepositoryTests.cs          # MODIFY: add tests for new methods

frontend/
  src/
    index.html            # MODIFY: add logout button
    login.html            # NEW
    setup.html            # NEW
    ts/
      main.ts             # MODIFY: add auth guard call + logout handler
      login.ts            # NEW
      setup.ts            # NEW
      auth-token.ts       # NEW
      auth-guard.ts       # NEW
      api-client.ts       # MODIFY: add Bearer header + 401 silent refresh retry
      config.ts           # unchanged
      model.ts            # unchanged
      ui.ts               # unchanged
      chart.ts            # unchanged
      storage.ts          # unchanged
      export.ts           # unchanged
      migration-tool.ts   # unchanged
  tests/
    auth-guard.test.ts    # NEW
    auth-token.test.ts    # NEW
    login.test.ts         # NEW (form submission + routing)
    setup.test.ts         # NEW (form submission + routing)
    api-client.test.ts    # MODIFY: add 401 retry tests
  vite.config.ts          # MODIFY: add rollupOptions.input for 3 HTML entry points
```

**Structure Decision**: Web application layout (backend + frontend). All new backend code follows the established Ports and Adapters pattern: Domain interfaces → Infrastructure implementations → Api endpoints. Frontend adds new modules alongside existing ones; no existing modules are deleted.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `RefreshToken` entity + server-side storage | Enables logout and token revocation; without server state, stolen refresh tokens cannot be invalidated | Stateless refresh (no server storage) cannot support secure logout |
| `IPasswordHasher` Domain interface | Keeps BCrypt dependency out of Domain layer; allows test doubles | Direct BCrypt calls in service would violate Ports & Adapters and make unit tests depend on BCrypt |
| Promise deduplication lock in fetch wrapper | Prevents multiple parallel token refresh requests on concurrent 401s | Without lock, 2+ simultaneous 401s could each trigger a refresh, invalidating each other via token rotation |
| Three-page Vite MPA (index + login + setup) | Each page needs independent JS bundle and routing guard | Single-page app routing would require a SPA router — unnecessary complexity for 3 static pages |
