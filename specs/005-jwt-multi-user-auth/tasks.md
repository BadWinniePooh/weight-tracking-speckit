# Tasks: Multi-User Support and JWT Authentication

**Input**: Design documents from `/specs/005-jwt-multi-user-auth/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Tests**: Included — TDD is NON-NEGOTIABLE per project constitution. Failing tests MUST be written before implementation in every phase.

**Organization**: Tasks grouped by user story (P1 → P5) so each story is independently implementable and testable. US5 and US6 share P5 priority and are sequenced because US6 builds on the user-management infrastructure from US5.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies within the phase)
- **[Story]**: User story this task belongs to (US1–US6, maps to spec.md)
- Exact file paths included on every task

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and wire the build system for this feature's technology additions.

- [x] T001 Add NuGet packages to `backend/WeightTracker.Api/WeightTracker.Api.csproj`: `Microsoft.AspNetCore.Authentication.JwtBearer` 8.0.x and to `backend/WeightTracker.Infrastructure/WeightTracker.Infrastructure.csproj`: `BCrypt.Net-Next` 4.1.x, `MailKit` 4.x, `MimeKit` 4.x
- [x] T002 [P] Add Vite MPA entry points for `login`, `reset-request`, `reset-complete`, and `setup` pages in `frontend/vite.config.ts`
- [x] T003 [P] Add JWT, SMTP, and admin bootstrap environment variable placeholders (empty defaults) to `docker-compose.yml` backend service
- [x] T004 [P] Update `backend/WeightTracker.Tests/Integration/Fixtures/ApiFixture.cs` to supply test JWT configuration (secret, issuer, audience) to the test host

**Checkpoint**: Dependencies installed, build succeeds, test host compiles with JWT config

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain entities, port interfaces, DB migration, and middleware wiring — everything every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Domain Entities

- [ ] T005 Extend `backend/WeightTracker.Domain/Entities/User.cs`: add `Username` (string, max 100), `Email` (string, max 255), `PasswordHash` (string), `Role` (enum `UserRole`), `IsActive` (bool, default true); add `UserRole { Admin, User }` enum in same file; remove `DisplayName`
- [ ] T006 [P] Create `backend/WeightTracker.Domain/Entities/RefreshToken.cs`: `Id` (Guid PK), `UserId` (Guid FK), `TokenHash` (string, max 64), `ExpiresAt` (DateTime UTC), `CreatedAt` (DateTime UTC), `IsUsed` (bool), `IsRevoked` (bool), nav property `User`
- [ ] T007 [P] Create `backend/WeightTracker.Domain/Entities/PasswordResetToken.cs`: `Id` (Guid PK), `UserId` (Guid FK), `TokenHash` (string, max 64), `ExpiresAt` (DateTime UTC), `CreatedAt` (DateTime UTC), `IsUsed` (bool), nav property `User`

### Domain Interfaces

- [ ] T008 Extend `backend/WeightTracker.Domain/Interfaces/Repositories/IUserRepository.cs`: add `GetByUsernameAsync`, `GetByEmailAsync`, `ListAllAsync`, `UpdateAsync`, `DeleteAsync`, `AnyAsync`
- [ ] T009 [P] Create `backend/WeightTracker.Domain/Interfaces/Repositories/IRefreshTokenRepository.cs`: `AddAsync`, `GetByTokenHashAsync`, `MarkUsedAsync`, `RevokeAllForUserAsync`
- [ ] T010 [P] Create `backend/WeightTracker.Domain/Interfaces/Repositories/IPasswordResetTokenRepository.cs`: `AddAsync`, `GetByTokenHashAsync`, `MarkUsedAsync`, `InvalidatePriorTokensForUserAsync`
- [ ] T011 [P] Create `backend/WeightTracker.Domain/Interfaces/Services/ITokenService.cs`: `GenerateAccessToken(User user) → string`, `GenerateRefreshTokenString() → string`, `HashToken(string token) → string`, `ValidateAccessToken(string token) → ClaimsPrincipal?`
- [ ] T012 [P] Create `backend/WeightTracker.Domain/Interfaces/Services/IPasswordHasher.cs`: `Hash(string plaintext) → string`, `Verify(string plaintext, string hash) → bool`
- [ ] T013 [P] Create `backend/WeightTracker.Domain/Interfaces/Services/IEmailService.cs`: `SendPasswordResetAsync(string toEmail, string resetLink) → Task`
- [ ] T014 [P] Create `backend/WeightTracker.Domain/Interfaces/Services/IAuthService.cs`: `LoginAsync`, `RefreshAsync`, `LogoutAsync`, `SetupAsync` (first-run), `RequestPasswordResetAsync`, `ResetPasswordAsync`

### Infrastructure — EF Core

- [ ] T015 Extend `backend/WeightTracker.Infrastructure/Data/AppDbContext.cs`: add `DbSet<RefreshToken>`, `DbSet<PasswordResetToken>`; configure entity mappings (table names, unique indexes on `TokenHash`, FK cascade-delete on all new tables, unique case-insensitive index on `User.Username`)
- [ ] T016 Generate EF Core migration: run `dotnet ef migrations add AddAuthTables` from `backend/WeightTracker.Api/` and verify the generated migration in `backend/WeightTracker.Infrastructure/Data/Migrations/` covers: (a) `Users` column changes — add `Username`, `Email`, `PasswordHash`, `Role`, `IsActive`; drop `DisplayName`; (b) new `RefreshTokens` table; (c) new `PasswordResetTokens` table; (d) `Down` migration deletes all rows from `WeightEntries` and `ChartSettings` where `UserId = '00000000-0000-0000-0000-000000000001'` and then drops the stub user row — this is intentional and permanent (all stub data is test data only)

### API Wiring

- [ ] T017 Update `backend/WeightTracker.Api/Program.cs`: add `builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(...)` reading `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` from configuration; add `app.UseAuthentication()` before `app.UseAuthorization()`; add `.AllowCredentials()` to CORS policy (required for httpOnly cookie cross-origin)
- [ ] T018 Update `backend/WeightTracker.Api/Middleware/CurrentUserMiddleware.cs`: read current user ID from `HttpContext.User` claims (JWT ClaimsPrincipal) instead of calling `ICurrentUserResolver`; return 401 if no valid claim found; check `User.IsActive` via `IUserRepository` and return 401 for deactivated accounts on protected routes

**Checkpoint**: Domain compiles with new entities/interfaces; migration scaffolded (including stub-user deletion); API project builds with JWT middleware registered

---

## Phase 3: User Story 1 — Secure User Login (Priority: P1) 🎯 MVP

**Goal**: Users can log in with username/password, receive a JWT access token, make authenticated requests, silently refresh on expiry, and log out.

**Independent Test**: Start the stack, hit `POST /api/auth/login` with valid credentials → get 200 + access token + cookie. Use the access token to call `GET /api/entries` → 200. Let the access token expire (or shorten expiry in test), call `POST /api/auth/refresh` → new access token. Call `POST /api/auth/logout` → 204. Confirm refresh cookie is cleared.

### Tests for User Story 1

> **Write these tests FIRST. Run `dotnet test` and confirm each FAILS before implementing.**

- [ ] T019 [US1] Write failing test: `POST /api/auth/login` with valid credentials returns 200, access token in body, `refreshToken` httpOnly cookie set — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T020 [P] [US1] Write failing test: `POST /api/auth/login` with wrong password returns 401 with generic message "Invalid username or password." — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T021 [P] [US1] Write failing test: `POST /api/auth/login` with valid credentials for a deactivated account returns 401 with a generic error message — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T022 [P] [US1] Write failing test: `POST /api/auth/refresh` with valid cookie returns 200, new access token, rotated refresh cookie — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T023 [P] [US1] Write failing test: `POST /api/auth/refresh` with already-used refresh token returns 401 and clears cookie — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T024 [P] [US1] Write failing test: `POST /api/auth/refresh` with a previously-used refresh token invalidates all remaining refresh tokens for that user (replay detection) and returns 401 — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T025 [P] [US1] Write failing test: `POST /api/auth/logout` returns 204 and clears `refreshToken` cookie — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T026 [P] [US1] Write failing test: `GET /api/entries` without Authorization header returns 401 — `backend/WeightTracker.Tests/Integration/Endpoints/EntryEndpointsTests.cs`

### Implementation for User Story 1

- [ ] T027 [US1] Implement `BcryptPasswordHasher` in `backend/WeightTracker.Infrastructure/Services/BcryptPasswordHasher.cs` (BCrypt.Net-Next, work factor 12, implements `IPasswordHasher`)
- [ ] T028 [P] [US1] Implement `RefreshTokenRepository` in `backend/WeightTracker.Infrastructure/Repositories/RefreshTokenRepository.cs` implementing `IRefreshTokenRepository`
- [ ] T029 [P] [US1] Implement `UserRepository` new methods in `backend/WeightTracker.Infrastructure/Repositories/UserRepository.cs`: `GetByUsernameAsync` (case-insensitive), `GetByEmailAsync`, `AnyAsync`
- [ ] T030 [US1] Implement `JwtTokenService` in `backend/WeightTracker.Infrastructure/Services/JwtTokenService.cs` implementing `ITokenService`: HS256 signing, 15-min access token lifetime, SHA-256 refresh token hashing, `ClaimsPrincipal` validation
- [ ] T031 [US1] Implement `AuthService.LoginAsync`, `AuthService.RefreshAsync`, `AuthService.LogoutAsync` in `backend/WeightTracker.Infrastructure/Services/AuthService.cs`: verify password hash, issue tokens, enforce single-use refresh tokens, replay detection (revoke all user tokens if a used token is presented again)
- [ ] T032 [US1] Implement `JwtCurrentUserResolver` in `backend/WeightTracker.Infrastructure/Services/JwtCurrentUserResolver.cs` (reads user ID from `IHttpContextAccessor` JWT claims, implements `ICurrentUserResolver`); delete `StubCurrentUserResolver.cs`
- [ ] T033 [US1] Implement `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` in `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`; set refresh token as HttpOnly, Secure, SameSite=Strict cookie with 30-day MaxAge; clear cookie on logout and on 401 refresh error
- [ ] T034 [US1] Register all new services in `backend/WeightTracker.Api/Program.cs`: `IPasswordHasher`→`BcryptPasswordHasher`, `ITokenService`→`JwtTokenService`, `IAuthService`→`AuthService`, `IRefreshTokenRepository`→`RefreshTokenRepository`, `ICurrentUserResolver`→`JwtCurrentUserResolver`, `IHttpContextAccessor`; add `app.MapAuthEndpoints()`; remove stub registration
- [ ] T035 [US1] Implement `frontend/src/ts/auth.ts`: in-memory access token variable, `getAccessToken()`, `setAccessToken(token)`, `clearAccessToken()`, `refreshAccessToken()` (POST `/api/auth/refresh` with `credentials: 'include'`, module-level deduplication flag + shared Promise to prevent concurrent refresh race condition)
- [ ] T036 [US1] Update `frontend/src/ts/api-client.ts`: inject `Authorization: Bearer <token>` header on every request using `auth.getAccessToken()`; on 401 response, call `auth.refreshAccessToken()` and retry once; on refresh failure, redirect to `/login`
- [ ] T037 [US1] Create `frontend/src/login.html` (username + password form, forgot-password link) and `frontend/src/ts/login.ts` (POST `/api/auth/login` with `credentials: 'include'`, store token via `auth.setAccessToken()`, redirect to `/index.html` on success)

**Checkpoint**: `dotnet test` green for T019–T026. Login, refresh, logout, and unauthenticated-rejection all work end-to-end.

---

## Phase 4: User Story 2 — First-Run Setup Wizard (Priority: P2)

**Goal**: A fresh installation with no users (and no admin env vars) shows a one-time wizard to create the initial admin. Once any user exists, the wizard is disabled. If env vars are set, the admin account is seeded automatically.

**Independent Test**: Start against empty DB with no `ADMIN_*` env vars → `GET /api/auth/status` returns `{ "firstRun": true }`. Open frontend → wizard page loads. Submit wizard → 200, admin account created, wizard inaccessible. Restart app → `GET /api/auth/status` returns `{ "firstRun": false }`.

### Tests for User Story 2

> **Write these tests FIRST. Run `dotnet test` and confirm each FAILS before implementing.**

- [ ] T038 [US2] Write failing test: `GET /api/auth/status` returns `{ firstRun: true, smtpConfigured: bool }` when no users exist — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T039 [P] [US2] Write failing test: `GET /api/auth/status` returns `{ firstRun: false }` after a user exists — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T040 [P] [US2] Write failing test: `POST /api/auth/setup` creates admin account and returns access token + refresh cookie when no users exist — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T041 [P] [US2] Write failing test: `POST /api/auth/setup` returns 409 Conflict when a user already exists — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`

### Implementation for User Story 2

- [ ] T042 [US2] Implement `AuthService.SetupAsync` in `backend/WeightTracker.Infrastructure/Services/AuthService.cs`: create admin user (hash password, set `Role = Admin`, `IsActive = true`); return access + refresh tokens; throw if any user already exists
- [ ] T043 [US2] Update `backend/WeightTracker.Infrastructure/Seeding/DatabaseSeeder.cs`: remove stub default-user seed entirely; add admin bootstrap logic — if `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` env vars are all present and no matching admin exists, create admin account using `IPasswordHasher`; log a warning and skip bootstrap if only some vars are set (partial configuration)
- [ ] T044 [US2] Add `GET /api/auth/status` (returns `{ firstRun, smtpConfigured }`) and `POST /api/auth/setup` to `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`; both endpoints are public (no `[Authorize]`); `/setup` delegates to `AuthService.SetupAsync` and returns 409 if users already exist
- [ ] T045 [US2] Create `frontend/src/setup.html` (username, email, password fields) and `frontend/src/ts/setup.ts` (POST `/api/auth/setup` with `credentials: 'include'`, store access token, redirect to dashboard on success; display error and link to login if 409)
- [ ] T046 [US2] Add boot-time routing logic to `frontend/src/ts/main.ts`: call `GET /api/auth/status` on page load; if `firstRun: true`, redirect to `setup.html`; if `firstRun: false` and no valid access token (memory empty and refresh fails), redirect to `login.html`; otherwise continue loading dashboard; if `smtpConfigured: false`, hide the "Forgot password?" link on login page

**Checkpoint**: `dotnet test` green for T038–T041. Fresh-install wizard and env-var bootstrap both functional.

---

## Phase 5: User Story 3 — Password Reset via Email (Priority: P3)

**Goal**: A user who forgot their password requests a reset link by email, clicks the link, and sets a new password. The old password no longer works. The endpoint always responds identically to prevent email enumeration.

**Independent Test**: Call `POST /api/auth/forgot-password` with a registered email → 200 (same message). Check MailHog for the email. Click the link → reset-complete page. Submit new password → 200. Login with new password → success. Login with old password → 401.

### Tests for User Story 3

> **Write these tests FIRST. Run `dotnet test` and confirm each FAILS before implementing.**

- [ ] T047 [US3] Write failing test: `POST /api/auth/forgot-password` returns 200 with generic message for a registered email — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T048 [P] [US3] Write failing test: `POST /api/auth/forgot-password` returns 200 with identical message for an unregistered email (anti-enumeration) — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T049 [P] [US3] Write failing test: `POST /api/auth/reset-password` with valid token updates password; old password login fails, new password login succeeds — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T050 [P] [US3] Write failing test: `POST /api/auth/reset-password` with expired token returns 400 — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T051 [P] [US3] Write failing test: `POST /api/auth/reset-password` with already-used token returns 400 — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`
- [ ] T052 [P] [US3] Write failing test: complete a successful password reset using a valid token via `POST /api/auth/reset-password`, then attempt to use the same token again → returns 400 (confirms single-use enforcement after successful use) — `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`

### Implementation for User Story 3

- [ ] T053 [US3] Implement `PasswordResetTokenRepository` in `backend/WeightTracker.Infrastructure/Repositories/PasswordResetTokenRepository.cs` implementing `IPasswordResetTokenRepository`
- [ ] T054 [US3] Implement `SmtpEmailService` in `backend/WeightTracker.Infrastructure/Services/SmtpEmailService.cs` (MailKit; reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SENDER_EMAIL` from `IConfiguration`; implements `IEmailService`)
- [ ] T055 [US3] Implement `AuthService.RequestPasswordResetAsync` and `AuthService.ResetPasswordAsync` in `backend/WeightTracker.Infrastructure/Services/AuthService.cs`: generate cryptographically random 32-byte token, SHA-256 hash for storage, 1-hour expiry; invalidate any prior unused token for the user; `ResetPasswordAsync` validates token, rehashes and stores new password, marks token used
- [ ] T056 [US3] Add `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` to `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`; both public; `forgot-password` always returns 200 regardless of email existence; return 503 if SMTP not configured
- [ ] T057 [US3] Register `IEmailService`→`SmtpEmailService`, `IPasswordResetTokenRepository`→`PasswordResetTokenRepository` in `backend/WeightTracker.Api/Program.cs`; update `GET /api/auth/status` to compute `smtpConfigured` based on whether all five SMTP env vars are present
- [ ] T058 [P] [US3] Create `frontend/src/reset-request.html` (email input, submit shows same confirmation message always) and `frontend/src/ts/reset-request.ts`
- [ ] T059 [P] [US3] Create `frontend/src/reset-complete.html` (new password input, reads `?token=` from URL query string, validates passwords match client-side before submit) and `frontend/src/ts/reset-complete.ts`

**Checkpoint**: `dotnet test` green for T047–T052. Password reset flow works end-to-end with MailHog.

---

## Phase 6: User Story 4 — Data Isolation Between Users (Priority: P4)

**Goal**: Each user can only read and write their own weight entries and chart settings. Cross-user access attempts are rejected server-side.

**Independent Test**: Create two user accounts. Log in as User A, create an entry. Log in as User B, attempt `DELETE /api/entries/{userA_entryId}` → 403. Attempt `GET /api/entries` as User B → no User A entries in response.

### Tests for User Story 4

> **Write these tests FIRST. Run `dotnet test` and confirm each FAILS before implementing.**

- [ ] T060 [US4] Write failing test: User B's token on `GET /api/entries` returns only User B's entries, not User A's — `backend/WeightTracker.Tests/Integration/Endpoints/EntryEndpointsTests.cs`
- [ ] T061 [P] [US4] Write failing test: User B's token on `DELETE /api/entries/{userA_entryId}` returns 403 — `backend/WeightTracker.Tests/Integration/Endpoints/EntryEndpointsTests.cs`
- [ ] T062 [P] [US4] Write failing test: User B's token on `GET /api/settings` returns User B's settings, not User A's — `backend/WeightTracker.Tests/Integration/Endpoints/SettingsEndpointsTests.cs`
- [ ] T063 [P] [US4] Write failing test: User B's token on `DELETE /api/entries` (delete-all) removes only User B's entries; User A's entries remain — `backend/WeightTracker.Tests/Integration/Endpoints/EntryEndpointsTests.cs`

### Implementation for User Story 4

- [ ] T064 [US4] Update `backend/WeightTracker.Api/Endpoints/EntryEndpoints.cs`: in `DELETE /api/entries/{id}`, after loading the entry verify `entry.UserId == currentUserId`; return 403 if mismatch; confirm all list and delete-all queries already filter by `currentUserId` via the repository; add any missing ownership checks
- [ ] T065 [P] [US4] Add `[Authorize]` requirement to all existing endpoint maps in `backend/WeightTracker.Api/Endpoints/`: `EntryEndpoints.cs`, `ChartEndpoints.cs`, `SettingsEndpoints.cs`, `MigrationEndpoints.cs` — unauthenticated callers receive 401

**Checkpoint**: `dotnet test` green for T060–T063. No cross-user data leakage possible via any existing endpoint.

---

## Phase 7: User Story 5 — Administrator User Management (Priority: P5)

**Goal**: Administrators can create, deactivate, re-activate, delete, and list user accounts and assign roles. Administrators cannot deactivate or delete their own account. Regular users are rejected from all admin endpoints.

**Independent Test**: Log in as admin. `POST /api/admin/users` → 201. `GET /api/admin/users` → list includes new user. New user logs in → 200. Admin `PATCH /api/admin/users/{newId}` with `isActive: false` → 200. New user login → 401. Admin `DELETE /api/admin/users/{newId}` → 204. New user login → 401.

### Tests for User Story 5

> **Write these tests FIRST. Run `dotnet test` and confirm each FAILS before implementing.**

- [ ] T066 [US5] Write failing test: admin `POST /api/admin/users` creates account; new user can log in — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T067 [P] [US5] Write failing test: admin `GET /api/admin/users` lists all users with correct fields — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T068 [P] [US5] Write failing test: admin `PATCH /api/admin/users/{id}` with `isActive: false` deactivates user; deactivated user login returns 401 — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T069 [P] [US5] Write failing test: admin `DELETE /api/admin/users/{id}` removes account; login with deleted credentials fails — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T070 [P] [US5] Write failing test: admin `PATCH /api/admin/users/{ownId}` with `isActive: false` returns 403 — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T071 [P] [US5] Write failing test: admin `DELETE /api/admin/users/{ownId}` returns 403 — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T072 [P] [US5] Write failing test: regular user `GET /api/admin/users` returns 403 — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`

### Implementation for User Story 5

- [ ] T073 [US5] Implement remaining `UserRepository` methods in `backend/WeightTracker.Infrastructure/Repositories/UserRepository.cs`: `GetByUsernameAsync`, `GetByEmailAsync`, `ListAllAsync`, `UpdateAsync`, `DeleteAsync`
- [ ] T074 [US5] Update `AuthService.LoginAsync` and `AuthService.RefreshAsync` in `backend/WeightTracker.Infrastructure/Services/AuthService.cs` to check `User.IsActive` and return 401/403 for deactivated accounts; when an account is deactivated via PATCH, call `IRefreshTokenRepository.RevokeAllForUserAsync` to immediately invalidate all existing sessions
- [ ] T075 [US5] Implement `backend/WeightTracker.Api/Endpoints/UserManagementEndpoints.cs`: `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/{id}`, `DELETE /api/admin/users/{id}`; require Admin role on all; reject self-deactivation and self-deletion with 403; return 409 on duplicate username or email at creation
- [ ] T076 [US5] Register `UserManagementEndpoints` and role-based authorization policy in `backend/WeightTracker.Api/Program.cs`: add `builder.Services.AddAuthorization()` with an Admin policy matching `UserRole.Admin` claim

**Checkpoint**: `dotnet test` green for T066–T072. Admin CRUD and role-based access fully enforced.

---

## Phase 8: User Story 6 — Account Merge (Priority: P5)

**Goal**: An administrator merges two user accounts. Weight entries move from source to target (no deduplication). Chart settings use smart-diff: only fields with differing values require admin selection; identical fields auto-merge. The response reports how many fields were manually resolved vs. auto-merged. Admin cannot be the source. Operation is atomic.

**Independent Test**: (A) User A has 3 entries; 2 of 5 settings fields differ from User B. Call merge with selections for only those 2 fields → 200, response shows `settingsManuallyResolved: 2, settingsAutoMerged: 3`, User B has 5 entries, User A deleted. (B) Repeat with all 5 settings fields identical; omit settings payload → 200, response shows `settingsManuallyResolved: 0, settingsAutoMerged: 5`, merge succeeds.

### Tests for User Story 6

> **Write these tests FIRST. Run `dotnet test` and confirm each FAILS before implementing.**

- [ ] T077 [US6] Write failing test: `POST /api/admin/users/{sourceId}/merge-into/{targetId}` with partial settings payload (only the 2 differing fields selected) moves all source entries to target, applies selected values for differing fields, preserves target values for identical fields, deletes source, returns 200 with `{ entriesMoved: N, settingsManuallyResolved: 2, settingsAutoMerged: 3 }` — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T078 [P] [US6] Write failing test: merge where all 5 settings fields are identical succeeds with no settings payload; response reports `settingsManuallyResolved: 0, settingsAutoMerged: 5` — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T079 [P] [US6] Write failing test: merge where source and target both have an entry on the same date results in both entries present on target after merge — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T080 [P] [US6] Write failing test: merge where sourceId == targetId returns 400 Bad Request — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T081 [P] [US6] Write failing test: admin attempting to use their own account as source returns 403 — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T082 [P] [US6] Write failing test: merge with a non-existent source or target returns 404 — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T083 [US6] Write failing test: simulate a database failure mid-merge (e.g., by injecting an error after entries are reassigned but before the source account is deleted) and assert that all source entries and the source account remain unchanged — full atomic rollback verified — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`
- [ ] T084 [P] [US6] Write failing test: `POST /api/admin/users/{sourceId}/merge-into/{targetId}` where source and target have at least one differing settings field but the request body omits the selection for that field returns 400 with a message identifying the missing field — `backend/WeightTracker.Tests/Integration/Endpoints/UserManagementEndpointsTests.cs`

### Implementation for User Story 6

- [ ] T085 [US6] Add `MergeAccountsAsync(Guid sourceId, Guid targetId, MergeSettingsSelection selection, Guid requestingAdminId) → Task<MergeResult>` to `backend/WeightTracker.Domain/Interfaces/Services/IAuthService.cs`; define in `backend/WeightTracker.Domain/Models/`: `MergeSettingsSelection` record with nullable fields (`weightGoal`, `lossRate`, `carbFatRatio`, `bufferValue`, `preferredUnit` — each `string?` with value `"source"` or `"target"`, omitted/null means fields are identical and auto-merged); `MergeResult` record with `int EntriesMoved`, `int SettingsManuallyResolved`, `int SettingsAutoMerged`
- [ ] T086 [US6] Implement `AuthService.MergeAccountsAsync` in `backend/WeightTracker.Infrastructure/Services/AuthService.cs`: validate sourceId ≠ targetId and sourceId ≠ requestingAdminId; open DB transaction; compare all 5 settings fields between source and target — for each field, if values are equal auto-merge (increment `SettingsAutoMerged`), if values differ use the provided selection (`"source"` or `"target"`) and increment `SettingsManuallyResolved`; bulk-update `WeightEntries.UserId` from source to target; apply resolved settings to target `ChartSettings`; revoke all refresh tokens for source; delete source user row (cascade deletes FK rows); commit; rollback on any exception; return `MergeResult`
- [ ] T087 [US6] Add `POST /api/admin/users/{sourceId}/merge-into/{targetId}` endpoint to `backend/WeightTracker.Api/Endpoints/UserManagementEndpoints.cs`: require Admin role; request body is `MergeSettingsSelection` (may be empty `{}` when all settings are identical); return 200 with `MergeResult` on success; 400 for same-account; 403 for self-source; 404 for missing source or target; 400 if a required selection (for a differing field) is absent from the payload

**Checkpoint**: `dotnet test` green for T077–T084. Smart-diff settings merge, atomicity, self-source protection, and duplicate-date retention all verified.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, validation, and housekeeping across all user stories.

- [ ] T088 [P] Run full backend test suite (`dotnet test`) and frontend tests (`cd frontend && npm test`) — fix any remaining failures across all phases
- [ ] T089 [P] Verify HttpOnly cookie attributes in `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`: confirm `HttpOnly = true`, `Secure = true`, `SameSite = SameSiteMode.Strict`, `MaxAge = TimeSpan.FromDays(30)` on refresh token cookie; confirm `MaxAge = 0` on logout and error paths
- [ ] T090 [P] Add startup cleanup of expired `RefreshTokens` and `PasswordResetTokens` rows (delete where `ExpiresAt < UtcNow`) in `backend/WeightTracker.Infrastructure/Seeding/DatabaseSeeder.cs` `SeedAsync` method to prevent unbounded table growth
- [ ] T091 [P] Validate quickstart.md flows manually: (a) env-var admin bootstrap, (b) first-run wizard, (c) password reset with MailHog, (d) account merge API call with smart-diff payload; document any discrepancies
- [ ] T092 Update `CLAUDE.md` `Recent Changes` entry for 005-jwt-multi-user-auth to reflect new dependencies (`Microsoft.AspNetCore.Authentication.JwtBearer`, `BCrypt.Net-Next`, `MailKit`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1 Login)**: Depends on Phase 2 — MVP; all later stories build on its auth infrastructure
- **Phase 4 (US2 Wizard)**: Depends on Phase 2; shares `AuthEndpoints.cs` and `AuthService.cs` with US1 — sequence after Phase 3 to avoid file conflicts
- **Phase 5 (US3 Password Reset)**: Depends on Phase 2; adds to same files as US1/US2 — sequence after Phase 4
- **Phase 6 (US4 Isolation)**: Depends on Phase 3 — requires working auth to test isolation meaningfully
- **Phase 7 (US5 Admin)**: Depends on Phase 3 and Phase 4 — requires working auth and a seeded admin account; creates `UserManagementEndpoints.cs`
- **Phase 8 (US6 Merge)**: Depends on Phase 7 — extends `UserManagementEndpoints.cs` and `AuthService.cs` created in US5
- **Phase 9 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no story dependencies
- **US2 (P2)**: After Phase 2 — sequence after US1 (shared files)
- **US3 (P3)**: After Phase 2 — sequence after US2 (shared files)
- **US4 (P4)**: After US1 — requires working auth
- **US5 (P5)**: After US1 + US2 — requires working auth + seeded admin
- **US6 (P5)**: After US5 — extends admin infrastructure; requires `UserManagementEndpoints.cs` to exist

### Within Each User Story (TDD Order)

1. Write failing tests — confirm `dotnet test` fails for right reason
2. Implement domain/infrastructure (models → repos → services)
3. Implement API endpoints
4. Implement frontend page (if applicable)
5. All tests green before moving to next story

### Parallel Opportunities

Within Phase 2: T006, T007, T009–T014 can all be authored in parallel (different files)

Within Phase 3: T020–T026 (US1 tests) can be authored in parallel; T028, T029 can run parallel with T027

Within Phase 4: T039–T041 (US2 tests) can be authored in parallel; T045 and T046 can run in parallel

Within Phase 5: T048–T052 (US3 tests) can be authored in parallel; T058 and T059 can run in parallel

Within Phase 6: T061–T063 (US4 tests) can be authored in parallel with T060

Within Phase 7: T067–T072 (US5 tests) can be authored in parallel with T066

Within Phase 8: T078–T084 (US6 tests) can be authored in parallel with T077

Phase 9: T088–T091 can all run in parallel

---

## Parallel Example: User Story 6

```bash
# Write all US6 tests together (independent paths in same file):
Task T077: smart-diff merge — partial settings payload, correct counts in response
Task T078: all-identical settings — no payload, auto-merge, 0 manual / 5 auto
Task T079: duplicate-date entries both retained
Task T080: same-account merge → 400
Task T081: admin-as-source → 403
Task T082: missing source/target → 404
Task T083: mid-transaction failure → full rollback, source account intact
Task T084: missing selection for differing field → 400 with field name

# After tests fail, implement in sequence (shared files):
Task T085: IAuthService.MergeAccountsAsync + MergeSettingsSelection + MergeResult domain models
Task T086: AuthService.MergeAccountsAsync with smart-diff logic  (depends T085)
Task T087: merge endpoint                                          (depends T086)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — **CRITICAL, blocks everything**
3. Complete Phase 3: User Story 1 (Login)
4. **STOP and VALIDATE**: Log in, use the app, verify scoped data
5. The app is usable as an authenticated personal tracker at this point

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Phase 3 (US1) → Login works — **MVP**
3. Phase 4 (US2) → Fresh installs self-configure
4. Phase 5 (US3) → Password recovery available
5. Phase 6 (US4) → Data isolation hardened
6. Phase 7 (US5) → Multi-user account management via API
7. Phase 8 (US6) → Account merge with smart-diff settings resolution
8. Phase 9 → Polish and ship

---

## Notes

- **TDD is mandatory**: Always write failing tests before implementing — per project constitution and CLAUDE.md
- **[P]** tasks modify different files; no intra-phase dependency conflicts
- **[Story]** label enables traceability back to spec acceptance scenarios
- Commit after each completed phase per constitution commit-cadence rule
- Commit message format: `feat(T0XX): implement <thing>` or `feat(phase-3): complete US1 login`
- `StubCurrentUserResolver` is deleted in T032 — do not reference it after that task
- The stub default user seed is removed in T043; the migration (T016) handles deletion of all orphaned `WeightEntries` and `ChartSettings` rows belonging to the stub UUID — this is intentional and permanent
- `MergeSettingsSelection` uses nullable fields — omit a field (or set to null) to indicate that field's values are identical and should auto-merge; include a field with `"source"` or `"target"` to indicate a differing value that requires explicit selection. Validate server-side that only `"source"` and `"target"` are accepted for non-null fields
- US6 has no frontend tasks in this spec — merge UI is deferred to spec 006
- The merge endpoint must validate that all differing fields have a selection in the payload; if a differing field is omitted, return 400 with a clear message indicating which field is missing
