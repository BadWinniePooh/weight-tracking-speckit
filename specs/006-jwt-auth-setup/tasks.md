# Tasks: JWT Authentication and First-Run Setup

**Input**: Design documents from `specs/006-jwt-auth-setup/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: TDD is mandatory per the project constitution and feature spec. Failing tests MUST be written before every implementation file.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on each other within the phase)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Domain + Migration)

**Purpose**: Establish new Domain entities, interfaces, and the EF Core migration before any implementation work. These are pure contracts and schema changes with no business logic.

- [X] T001 Add `Microsoft.AspNetCore.Authentication.JwtBearer` v8.0.x to `backend/WeightTracker.Api/WeightTracker.Api.csproj` and `BCrypt.Net-Next` v4.x to `backend/WeightTracker.Infrastructure/WeightTracker.Infrastructure.csproj`
- [X] T002 [P] Update `backend/WeightTracker.Domain/Entities/User.cs`: add `Username` (string), `Email` (string), `PasswordHash` (string), `Role` (string, default `"user"`), `IsActive` (bool, default `true`), `ICollection<RefreshToken> RefreshTokens` navigation; remove `DisplayName`
- [X] T003 [P] Create `backend/WeightTracker.Domain/Entities/RefreshToken.cs`: fields `Id` (Guid PK), `UserId` (Guid FK), `TokenHash` (string), `ExpiresAt` (DateTime), `RevokedAt` (DateTime?), `CreatedAt` (DateTime); navigation `User`
- [X] T004 [P] Extend `backend/WeightTracker.Domain/Interfaces/Repositories/IUserRepository.cs`: add `GetByUsernameAsync(string username)` → `Task<User?>` and `ExistsAnyAsync()` → `Task<bool>`
- [X] T005 [P] Create `backend/WeightTracker.Domain/Interfaces/Repositories/IRefreshTokenRepository.cs`: methods `GetActiveByHashAsync(string tokenHash)` → `Task<RefreshToken?>`, `AddAsync(RefreshToken)` → `Task<RefreshToken>`, `RevokeAsync(Guid tokenId)` → `Task`, `RevokeAllForUserAsync(Guid userId)` → `Task`
- [X] T006 [P] Create `backend/WeightTracker.Domain/Interfaces/Services/ITokenService.cs`: methods `GenerateTokensAsync(User user)` → `Task<(string AccessToken, string RefreshToken)>`, `RenewAccessTokenAsync(Guid userId, string refreshToken)` → `Task<string?>`, `InvalidateAllTokensAsync(Guid userId)` → `Task`
- [X] T007 [P] Create `backend/WeightTracker.Domain/Interfaces/Services/IPasswordHasher.cs`: methods `Hash(string password)` → `string`, `Verify(string password, string hash)` → `bool`
- [X] T008 Update `backend/WeightTracker.Infrastructure/Data/AppDbContext.cs`: add `DbSet<RefreshToken> RefreshTokens` property; in `OnModelCreating` add Fluent API configuration for `User` entity (columns `Username` max 100 required, `Email` max 255 required, `PasswordHash` required, `Role` max 20 required, `IsActive` required; remove `DisplayName` config; add unique indexes on `Username` and `Email`) and `RefreshToken` entity (`TokenHash` max 64 required unique, `ExpiresAt` required, `RevokedAt` nullable, `CreatedAt` required; `HasOne(r => r.User).WithMany(u => u.RefreshTokens).HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade)`; composite index on `(UserId, ExpiresAt)`); prerequisite for T009 (migration generation) and T016 (RefreshTokenRepository)
- [X] T009 Generate and customise EF Core migration `AddJwtAuthentication`: run `dotnet ef migrations add AddJwtAuthentication -p WeightTracker.Infrastructure -s WeightTracker.Api` from `backend/`, then edit the generated file in `backend/WeightTracker.Infrastructure/Data/Migrations/` to: alter Users table (add columns, drop `DisplayName`), create RefreshTokens table with three indexes (TokenHash UNIQUE, UserId, UserId+ExpiresAt), add FK with cascade delete, and add `MigrationBuilder.Sql()` to delete stub user data (ID `00000000-0000-0000-0000-000000000001`) and all related WeightEntries and ChartSettings rows

**Checkpoint**: Domain layer compiles cleanly; migration file exists and is correct SQL-wise

---

## Phase 2: Foundational (Infrastructure + API Config)

**Purpose**: Implement all shared infrastructure services and configure ASP.NET Core auth pipeline. This phase MUST be complete before any user story endpoint work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests (TDD — write these first, verify they FAIL)

- [X] T010 Write failing tests for `BcryptPasswordHasher` in `backend/WeightTracker.Tests/Unit/Services/BcryptPasswordHasherTests.cs`: test `Hash()` returns 60-char BCrypt string, `Verify()` returns true for correct password, `Verify()` returns false for wrong password
- [X] T011 [P] Write failing tests for new `UserRepository` methods in `backend/WeightTracker.Tests/Integration/Repositories/UserRepositoryTests.cs`: `GetByUsernameAsync` returns user for known username, returns null for unknown, case-insensitive; `ExistsAnyAsync` returns false on empty DB, true after insert
- [X] T012 [P] Write failing tests for `RefreshTokenRepository` in `backend/WeightTracker.Tests/Integration/Repositories/RefreshTokenRepositoryTests.cs`: `GetActiveByHashAsync` returns active token by hash, returns null for revoked/expired/unknown; `RevokeAsync` sets `RevokedAt`; `RevokeAllForUserAsync` revokes all tokens for user
- [X] T013 [P] Write failing tests for `JwtTokenService` in `backend/WeightTracker.Tests/Unit/Services/JwtTokenServiceTests.cs`: `GenerateTokensAsync` returns non-empty JWT and refresh token; `RenewAccessTokenAsync` returns new JWT for valid refresh token, null for invalid; `InvalidateAllTokensAsync` makes subsequent renew return null
- [X] T018 [P] Write failing tests for `JwtCurrentUserResolver` in `backend/WeightTracker.Tests/Unit/Infrastructure/JwtCurrentUserResolverTests.cs`: test that a valid `IHttpContextAccessor` with a user context containing a `sub` claim returns the correct `Guid` user ID; test that a context with an invalid or expired JWT (no valid `sub` claim) throws `UnauthorizedAccessException`; test that a null `HttpContext` (no user context) throws `UnauthorizedAccessException`

### Implementation

- [X] T014 Implement `BcryptPasswordHasher` in `backend/WeightTracker.Infrastructure/Services/BcryptPasswordHasher.cs` using `BCrypt.Net.BCrypt.HashPassword(password, 12)` and `BCrypt.Net.BCrypt.Verify(password, hash)`; ensure T010 tests pass
- [X] T015 [P] Extend `UserRepository` in `backend/WeightTracker.Infrastructure/Repositories/UserRepository.cs` with `GetByUsernameAsync` (case-insensitive username lookup) and `ExistsAnyAsync`; ensure T011 tests pass
- [X] T016 [P] Implement `RefreshTokenRepository` in `backend/WeightTracker.Infrastructure/Repositories/RefreshTokenRepository.cs` with all `IRefreshTokenRepository` methods; active token query: `WHERE TokenHash = ? AND RevokedAt IS NULL AND ExpiresAt > UTC_NOW`; ensure T012 tests pass
- [X] T017 [P] Implement `JwtTokenService` in `backend/WeightTracker.Infrastructure/Services/JwtTokenService.cs`: access token = signed JWT (claims: sub, jti, iat, exp=+15min, iss=`weight-tracker`, aud=`weight-tracker-api`); refresh token = 32 random bytes Base64-encoded, stored as SHA-256 hex hash via `IRefreshTokenRepository`; constructor reads `JWT_SECRET` from `IConfiguration`; ensure T013 tests pass
- [X] T019 Implement `JwtCurrentUserResolver` in `backend/WeightTracker.Infrastructure/Services/JwtCurrentUserResolver.cs`: inject `IHttpContextAccessor`; read `sub` claim from `httpContextAccessor.HttpContext?.User`; return `Guid.Parse(sub)` or throw `UnauthorizedAccessException` if missing; delete `StubCurrentUserResolver.cs`; ensure T018 tests pass
- [X] T020 Update `backend/WeightTracker.Api/Program.cs`: add `AddAuthentication().AddJwtBearer(...)` with validation parameters (issuer, audience, signing key from `JWT_SECRET` env var), add `AddAuthorization()`, update CORS policy — `AllowCredentials()` requires a specific origin, do NOT use `AllowAnyOrigin()` which is incompatible with `AllowCredentials()`; read the allowed origin from the `ALLOWED_ORIGIN` env var and pass it to `WithOrigins(allowedOrigin)` — the wildcard origin (`*`) MUST NOT be used when credentials are allowed; register `IPasswordHasher → BcryptPasswordHasher`, `ITokenService → JwtTokenService`, `IRefreshTokenRepository → RefreshTokenRepository`, `IHttpContextAccessor`, `ICurrentUserResolver → JwtCurrentUserResolver`; add `UseAuthentication()` and `UseAuthorization()` to pipeline; remove `StubCurrentUserResolver` registration

**Checkpoint**: `cd backend && dotnet test` — all existing tests pass; new unit/integration tests pass

---

## Phase 3: User Story 1 — First-Run Setup Wizard (Priority: P1) 🎯 MVP

**Goal**: A fresh installation with no users redirects to the setup wizard; admin account is created via form or env-var auto-seeding; wizard is blocked once any user exists.

**Independent Test**: Deploy with empty DB → navigate to app → confirm redirect to `/setup.html`; complete setup form → confirm redirect to `/login.html`; attempt setup again → confirm 409 response; set `ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD` env vars with empty DB → confirm admin account created on startup without UI interaction.

### Tests (TDD — write these first, verify they FAIL)

- [X] T021 [US1] Write failing tests for setup endpoints in `backend/WeightTracker.Tests/Integration/Endpoints/SetupEndpointsTests.cs`: `GET /api/setup/status` returns `{"firstRun":true}` on empty DB, `{"firstRun":false}` after user exists; `POST /api/setup/initialize` returns 201 on first call with valid body, 409 on second call, 400 with missing fields (username, email, password), 400 when password is shorter than 8 characters (spec minimum length from Assumptions)
- [X] T022 [US1] Write failing tests for env-var seeding in `backend/WeightTracker.Tests/Integration/Seeding/DatabaseSeederTests.cs`: when `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` all set and DB empty → user created with role `admin`; when all env vars missing → no user created; when user already exists → no duplicate created; when only 1 or 2 of the 3 env vars are present (e.g., `ADMIN_USERNAME` set but `ADMIN_PASSWORD` absent) → seeding does NOT run, a warning is logged via `ILogger`, and the app falls through to first-run interactive mode without crashing
- [X] T023 [P] [US1] Write failing tests for `auth-token.ts` in `frontend/tests/auth-token.test.ts`: `getAccessToken()` returns null initially; `setAccessToken("xyz")` then `getAccessToken()` returns `"xyz"`; `clearAccessToken()` then `getAccessToken()` returns null
- [X] T024 [P] [US1] Write failing tests for `auth-guard.ts` routing logic in `frontend/tests/auth-guard.test.ts`: mock fetch responses for setup status + refresh; verify all redirect cases from the routing table in `contracts/frontend-modules.md`
- [X] T025 [P] [US1] Write failing tests for `setup.ts` form submission in `frontend/tests/setup.test.ts`: mock `checkAuthStatus` returning `{ setupRequired: true, isAuthenticated: false }` and `enforceRedirect` as no-op; on valid form submission → `POST /api/setup/initialize` called with `{ username, email, password }`; on 201 response → `window.location.href` set to `/login.html`; on 409 response → error message displayed in `#error-message`; on 400 response → validation error displayed; on password !== confirm-password → form does not submit and error shown

### Implementation

- [X] T026 [P] [US1] Implement `GET /api/setup/status` and `POST /api/setup/initialize` in `backend/WeightTracker.Api/Endpoints/SetupEndpoints.cs`: status uses `IUserRepository.ExistsAnyAsync()`; initialize validates input (including minimum 8-character password), calls `IPasswordHasher.Hash()`, creates `User` with role `"admin"`, returns 201; returns 409 if `ExistsAnyAsync()` is true; both endpoints explicitly marked `AllowAnonymous`
- [X] T027 [US1] Update `backend/WeightTracker.Infrastructure/Seeding/DatabaseSeeder.cs`: remove stub user seed; add env-var admin seeding — if `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` all present in `IConfiguration` and `ExistsAnyAsync()` is false, create admin user using `IPasswordHasher.Hash()`; if only some env vars are present, log a warning via `ILogger<DatabaseSeeder>` and skip seeding (fall through to first-run mode)
- [X] T028 [US1] Register setup endpoints in `backend/WeightTracker.Api/Program.cs` (call `SetupEndpoints.Map(app)`)
- [X] T029 [P] [US1] Create `frontend/src/setup.html`: minimal page with fields `username`, `email`, `password`, `confirm-password`, a submit button, an inline `id="error-message"` container, and `<script type="module" src="ts/setup.ts">`
- [X] T030 [P] [US1] Create `frontend/src/ts/auth-token.ts`: module-level `_accessToken: string | null = null`; export `setAccessToken`, `getAccessToken`, `clearAccessToken`; ensure T023 tests pass
- [X] T031 [P] [US1] Create `frontend/src/ts/auth-guard.ts`: export `AuthState` interface, `checkAuthStatus()` (calls `GET /api/setup/status`, then `POST /api/auth/refresh` with `credentials: "include"`; stores access token on success), and `enforceRedirect(pageType, state)` implementing full routing table; ensure T024 tests pass
- [X] T032 [US1] Update `frontend/vite.config.ts` with `rollupOptions.input` specifying all three HTML entry points (`main: "src/index.html"`, `login: "src/login.html"`, `setup: "src/setup.html"`)
- [X] T033 [US1] Create `frontend/src/ts/setup.ts`: `DOMContentLoaded` handler that (1) calls `checkAuthStatus()` + `enforceRedirect("setup", state)`, (2) validates password === confirm-password client-side, (3) `POST /api/setup/initialize` with `{ username, email, password }`, (4) on 201 redirects to `/login.html`, (5) on 409/400 shows inline error message; ensure T025 tests pass

**Checkpoint**: Fresh-DB smoke test passes; `POST /api/setup/initialize` returns 409 on second attempt; env-var seeding creates admin on startup; partial env-var config logs warning and does not crash

---

## Phase 4: User Story 2 — User Login and Session Establishment (Priority: P2)

**Goal**: Registered user submits credentials, receives an access token (memory), a refresh token cookie is set, and they are redirected to the main app. All existing endpoints return 401 without a valid token. Every page redirects based on auth state before rendering.

**Independent Test**: Login with correct credentials → redirected to app → weight entries visible; login with wrong password → error displayed, stays on login page; navigate directly to `/index.html` without token → redirected to `/login.html`.

### Tests (TDD — write these first, verify they FAIL)

- [X] T034 [US2] Write failing tests for `POST /api/auth/login` in `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`: returns 200 + `accessToken` + `Set-Cookie: refreshToken=...` for valid credentials; returns 401 for unknown username; returns 401 for wrong password (same error message — no enumeration)
- [X] T035 [P] [US2] Write failing tests for `login.ts` form submission in `frontend/tests/login.test.ts`: mock `checkAuthStatus` returning `{ setupRequired: false, isAuthenticated: false }` and `enforceRedirect` as no-op; on valid form submission → `POST /api/auth/login` called with `{ username, password }`; on 200 response → `setAccessToken` called with received `accessToken` and `window.location.href` set to `/index.html`; on 401 response → "Invalid username or password." shown in `#error-message`; on network error → "Unable to reach server." shown in `#error-message`
- [X] T037 [P] [US2] Write failing tests for protected endpoint authorization in `backend/WeightTracker.Tests/Integration/Endpoints/ProtectedEndpointsAuthTests.cs`: verify `GET /api/entries`, `GET /api/chart`, and `GET /api/settings` each return `401 Unauthorized` when called without an `Authorization: Bearer` header; verify they each return `200 OK` when called with a valid signed JWT in the `Authorization: Bearer` header

### Implementation

- [X] T036 [US2] Implement `POST /api/auth/login` in `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`: retrieve user by username (`IUserRepository.GetByUsernameAsync`), verify password (`IPasswordHasher.Verify`), call `ITokenService.GenerateTokensAsync`, return `{ accessToken, expiresIn: 900, tokenType: "Bearer" }` in body, set `refreshToken` as HttpOnly SameSite=Strict Secure cookie (7-day expiry); return 401 with generic message on any failure; mark `AllowAnonymous`
- [X] T038 [US2] Register auth endpoints in `backend/WeightTracker.Api/Program.cs`; add `.RequireAuthorization()` to all existing endpoint groups in `EntryEndpoints`, `ChartEndpoints`, `SettingsEndpoints`, and `MigrationEndpoints`; **note**: `GET /api/health` MUST remain publicly accessible (no `.RequireAuthorization()`) so Docker Compose health checks continue to work after authentication middleware is added; ensure T037 tests pass
- [X] T039 [P] [US2] Create `frontend/src/login.html`: fields `username`, `password`, submit button, `id="error-message"`, `<script type="module" src="ts/login.ts">`
- [X] T040 [P] [US2] Create `frontend/src/ts/login.ts`: `DOMContentLoaded` → `checkAuthStatus()` + `enforceRedirect("login", state)`; on form submit: `POST /api/auth/login`, on 200 call `setAccessToken` and redirect to `/index.html`; on 401 show "Invalid username or password."; on network error show "Unable to reach server."; ensure T035 tests pass
- [X] T041 [US2] Update `frontend/src/ts/main.ts`: add `checkAuthStatus()` + `enforceRedirect("app", state)` as the very first actions inside `DOMContentLoaded`, before any config load or API call; add logout button click handler stub (implemented fully in Phase 6)

**Checkpoint**: Login flow end-to-end works; navigating to `/index.html` without token redirects to `/login.html`; `/api/entries` returns 401 without `Authorization` header

---

## Phase 5: User Story 3 — Secure Session Continuity (Priority: P3)

**Goal**: Reloading the page restores the session silently via the refresh token cookie. If the access token expires mid-session, it is renewed transparently before the failing request is retried.

**Independent Test**: Log in, reload page → app loads without login prompt; wait for access token to expire (or shorten to 5s for testing) and perform an action → action succeeds without login redirect; log out in another tab, reload → redirected to login.

### Tests (TDD — write these first, verify they FAIL)

- [X] T042 [US3] Write failing tests for `POST /api/auth/refresh` in `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`: returns 200 + new `accessToken` + new `Set-Cookie: refreshToken` for valid cookie; returns 401 for missing/expired/revoked cookie; old refresh token is revoked after successful refresh (token rotation)
- [X] T043 [US3] Write failing tests for 401 silent retry in `frontend/tests/api-client.test.ts`: simulate 401 on first call → verify refresh called once → verify original request retried with new token; simulate 401 + failed refresh → verify `clearAccessToken()` called and redirect to login; verify concurrent 401s only trigger one refresh attempt

### Implementation

- [X] T044 [US3] Implement `POST /api/auth/refresh` in `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`: read `refreshToken` cookie value, call `ITokenService.RenewAccessTokenAsync` (validates hash, checks not revoked/expired, rotates token — old revoked, new issued), return new access token in body + new refresh token cookie; return 401 and clear cookie on invalid token; mark `AllowAnonymous`
- [X] T045 [US3] Update `frontend/src/ts/api-client.ts`: (1) include `Authorization: Bearer <token>` header from `getAccessToken()` on every request; (2) add promise-based deduplication lock (`_refreshPromise`); (3) on 401 response: if refresh in flight wait for it, else start refresh via `POST /api/auth/refresh` (credentials: `include`), store new token; retry original request once; if still 401 or refresh fails: `clearAccessToken()` + redirect to `/login.html`; ensure T043 tests pass

**Checkpoint**: Session survives page reload; expired access token triggers transparent renewal; concurrent 401s cause only one refresh call

---

## Phase 6: User Story 4 — Logout (Priority: P4)

**Goal**: User clicks logout. Session is invalidated server-side. In-memory token is cleared. User is redirected to login. Old session credentials no longer grant access.

**Independent Test**: Log in → click logout → confirm redirect to `/login.html`; attempt to use the previous access token on any endpoint → confirm 401; reload after logout → confirm stays on login page (no silent restore).

### Tests (TDD — write these first, verify they FAIL)

- [X] T046 [US4] Write failing tests for `POST /api/auth/logout` in `backend/WeightTracker.Tests/Integration/Endpoints/AuthEndpointsTests.cs`: returns 204 with valid JWT; subsequent `POST /api/auth/refresh` with old cookie returns 401; cookie is cleared in response
- [X] T047 [P] [US4] Write failing tests for logout handler in `frontend/tests/main.test.ts`: mock `fetch` to return 204 on `POST /api/auth/logout`; mock `clearAccessToken`; simulate click on `#logout-button`; verify `POST /api/auth/logout` called with `credentials: "include"`; verify `clearAccessToken()` called; verify `window.location.href` set to `/login.html`; verify that if logout request fails the in-memory token is still cleared and the user is still redirected to `/login.html`

### Implementation

- [X] T048 [US4] Implement `POST /api/auth/logout` in `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`: call `ITokenService.InvalidateAllTokensAsync(userId)` using `sub` claim from JWT; clear `refreshToken` cookie (set expired); return 204; requires auth
- [X] T049 [US4] Add logout button to `frontend/src/index.html` (e.g., `<button id="logout-button">Log out</button>` in the app header)
- [X] T050 [US4] Implement logout handler in `frontend/src/ts/main.ts`: on logout button click, call `POST /api/auth/logout` (with `credentials: "include"`), call `clearAccessToken()`, redirect to `/login.html`; ensure T047 tests pass

**Checkpoint**: Full auth lifecycle works end-to-end — setup → login → use app → logout → cannot re-access without login

---

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Environment configuration, documentation, and final validation.

- [X] T051 [P] Update `docker-compose.yml`: add `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` environment variables to the `backend` service block
- [X] T052 [P] Update `.env.example`: add `JWT_SECRET` (with placeholder note to generate a 32+ char random string), `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (all with example/placeholder values)
- [X] T053 Update `docs/runbook.md`: add "Authentication Setup" section covering first-run wizard, env-var auto-seeding, JWT secret generation, cookie requirements for HTTPS deployments
- [X] T054 Run full test suite and confirm all green: `cd backend && dotnet test` (backend) and `cd frontend && npm test` (frontend); fix any failures before marking this phase complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002–T007 are all parallel; T008 (AppDbContext) must complete before T009 (migration)
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories; T010–T013, T018 (test writing) are parallel; T014–T017, T019 (implementations) are parallel after tests; T020 (Program.cs) follows T019
- **Phase 3 (US1)**: Depends on Phase 2 complete
- **Phase 4 (US2)**: Depends on Phase 3 complete (auth-guard.ts and auth-token.ts created in Phase 3)
- **Phase 5 (US3)**: Depends on Phase 4 (needs login endpoint and api-client.ts in place)
- **Phase 6 (US4)**: Depends on Phase 4 (needs auth endpoints registered and main.ts guard in place)
- **Phase 7 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only — no dependency on other stories; creates shared auth-guard and auth-token modules consumed by all pages
- **US2 (P2)**: Depends on Phase 3 (auth-guard.ts and auth-token.ts must exist); integrates with US1 (redirect to setup if needed)
- **US3 (P3)**: Depends on US2 (needs login endpoint and api-client.ts)
- **US4 (P4)**: Depends on US2 (needs auth endpoints + main.ts guard wired up)

### Within Each User Story

- Test tasks MUST be written first and confirmed FAILING before implementation
- Domain interfaces → Repository implementations → Service implementations → Endpoint implementations
- Backend endpoints before frontend pages that call them
- Core modules (auth-token, auth-guard) before pages that import them

---

## Parallel Execution Examples

### Phase 1 (T002–T007 all parallel; T008 then T009 sequential)

```
T002 Update User entity        T003 Create RefreshToken entity
T004 Extend IUserRepository    T005 Create IRefreshTokenRepository
T006 Create ITokenService      T007 Create IPasswordHasher
         ↓ (all complete)
T008 Update AppDbContext.cs
         ↓
T009 Generate migration
```

### Phase 2 test writing (T010–T013, T018 all parallel)

```
T010 BcryptPasswordHasherTests    T011 UserRepositoryTests
T012 RefreshTokenRepositoryTests  T013 JwtTokenServiceTests
T018 JwtCurrentUserResolverTests
```

### Phase 2 implementation (T014–T017 parallel after tests; T019 after T018)

```
T014 BcryptPasswordHasher    T015 UserRepository (new methods)
T016 RefreshTokenRepository  T017 JwtTokenService
         ↓ (T018 test confirmed failing)
T019 JwtCurrentUserResolver
         ↓
T020 Program.cs config
```

### Phase 3 frontend tests (T023–T025 all parallel)

```
T023 auth-token.test.ts    T024 auth-guard.test.ts
T025 setup.test.ts
```

### Phase 3 frontend implementation (T029–T031 parallel after tests)

```
T029 setup.html    T030 auth-token.ts    T031 auth-guard.ts
```

### Phase 4 (T034, T035, T037 parallel; T036 after T034; T038 after T036+T037; T039–T040 parallel after T036–T038)

```
T034 AuthEndpointsTests (login)    T035 login.test.ts    T037 ProtectedEndpointsAuthTests
         ↓ T034 complete
T036 Implement /api/auth/login
         ↓ T036+T037 complete
T038 Register endpoints + protect existing
         ↓ T036–T038 complete
T039 login.html    T040 login.ts
```

---

## Implementation Strategy

### MVP (Phase 1 + Phase 2 + Phase 3 only)

1. Complete Phase 1: Domain entities + AppDbContext + migration
2. Complete Phase 2: Infrastructure + API config
3. Complete Phase 3: US1 (setup wizard + shared auth modules + vite.config)
4. **STOP AND VALIDATE**: Fresh DB → setup wizard creates admin → 409 on second attempt → env-var seeding works → partial env-var config logs warning
5. This proves the auth infrastructure is solid before login UI is built

### Incremental Delivery

1. Phases 1–3 → Setup wizard works (MVP); shared auth-guard and auth-token modules ready
2. Add Phase 4 → Login + protected endpoints + frontend routing guard + login page
3. Add Phase 5 → Session continuity (silent refresh)
4. Add Phase 6 → Logout
5. Add Phase 7 → Config, docs, final validation

---

## Notes

- [P] tasks = different files, no unresolved dependencies within the current phase
- [USn] label maps each task to a specific user story for traceability
- TDD mandatory: every implementation task group is preceded by failing test tasks
- Commit after each phase (per project constitution commit cadence)
- Token rotation means every successful `/api/auth/refresh` call invalidates the old cookie — test this explicitly in T042
- `JWT_SECRET` must be at least 256 bits (32 bytes) for HS256 signing — generate with `openssl rand -base64 32`
- The `Secure` cookie flag requires HTTPS; for local dev without HTTPS, temporarily set `Secure=false` (controlled by `ASPNETCORE_ENVIRONMENT`)
- `auth-token.ts` and `auth-guard.ts` are in Phase 3 (US1) because setup.ts depends on them; they serve all pages equally
- `GET /api/health` must remain public (no auth required) to support Docker Compose health checks
