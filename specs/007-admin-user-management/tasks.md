# Tasks: Admin & User Management with Email Infrastructure

**Input**: Design documents from `/specs/007-admin-user-management/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Tests**: TDD is **mandatory** throughout (constitution §III). Every feature phase begins with failing tests. Implement only after tests are written and confirmed to fail for the right reason.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- All file paths are absolute from repository root

---

## Phase 1: Setup (Dependency Installation)

**Purpose**: Add new NuGet packages required by this feature before any code is written.

- [x] T001 Add MailKit NuGet package (version 4.x) to `backend/WeightTracker.Infrastructure/WeightTracker.Infrastructure.csproj`
- [x] T002 Add `Testcontainers` (generic container, version 3.10.0 to match existing) NuGet package to `backend/WeightTracker.Tests/WeightTracker.Tests.csproj`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain entities, infrastructure, and test fixture changes that ALL user story phases depend on. No user story work begins until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

> **TDD NOTE**: These tasks create the scaffolding that test phases in US1–US6 will depend on. Entity and interface definitions should be created first so tests can reference them.

- [x] T003 [P] Extend `User` entity with `ScheduledDeletionAt` (nullable DateTime), `EmailConfirmed` (bool, default false), `PendingEmail` (nullable string), `LastLoginAt` (nullable DateTime) in `backend/WeightTracker.Domain/Entities/User.cs`
- [x] T004 [P] Create `PasswordResetToken` entity (Id, UserId, TokenHash, ExpiresAt, UsedAt, CreatedAt) in `backend/WeightTracker.Domain/Entities/PasswordResetToken.cs`
- [x] T005 [P] Create `EmailConfirmationToken` entity (Id, UserId, TargetEmail, TokenHash, ExpiresAt, UsedAt, CreatedAt) in `backend/WeightTracker.Domain/Entities/EmailConfirmationToken.cs`
- [x] T006 [P] Create `AuditLogEntry` entity (Id, ActionType, ActorUserId, TargetUserId nullable, IpAddress, Timestamp) in `backend/WeightTracker.Domain/Entities/AuditLogEntry.cs`
- [x] T007 [P] Create domain models `UserDto`, `AuditLogFilter` (Page, PageSize, FromDate, ToDate, ActionType), `AuditLogPage` (Entries, TotalCount) in `backend/WeightTracker.Domain/Models/`
- [x] T008 [P] Create `IEmailService` port with `SendAsync(to, subject, htmlBody, CancellationToken)` in `backend/WeightTracker.Domain/Interfaces/Services/IEmailService.cs`
- [x] T009 Update `AppDbContext` to add `DbSet<PasswordResetToken>`, `DbSet<EmailConfirmationToken>`, `DbSet<AuditLogEntry>` and configure all three in `OnModelCreating` (per data-model.md) in `backend/WeightTracker.Infrastructure/Data/AppDbContext.cs`
- [x] T010 Generate EF Core migration `AddUserManagementAndEmailInfrastructure` (adds 3 new tables + User column additions; back-fills `EmailConfirmed = true` for existing users) in `backend/WeightTracker.Infrastructure/Data/Migrations/`
- [x] T011 Implement `SmtpEmailService` using MailKit, reading `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SENDER_EMAIL` from configuration in `backend/WeightTracker.Infrastructure/Services/SmtpEmailService.cs`
- [x] T012 Add `AdminOnly` authorization policy (`RequireClaim("role", "admin")`) to `Program.cs` and update `JwtTokenService` to include the user's `Role` as a `"role"` claim in issued access tokens in `backend/WeightTracker.Api/Program.cs` and `backend/WeightTracker.Infrastructure/Services/JwtTokenService.cs`
- [x] T013 Update `ApiFixture` to: (1) spin up MailHog generic Testcontainer (image `mailhog/mailhog:latest`, SMTP 1025, HTTP 8025), (2) inject SMTP settings + `APP_BASE_URL` into `ConfigureWebHost`, (3) update `EnsureTestUserExists` to set `EmailConfirmed = true` for the test user, (4) add a seeded admin test user (`AdminUserId`), (5) extend `GenerateTestJwt` to accept a role parameter and include `"role"` claim in `backend/WeightTracker.Tests/Integration/Fixtures/ApiFixture.cs`
- [x] T013a Register `IEmailService` → `SmtpEmailService` in `backend/WeightTracker.Api/Program.cs` — must be registered in Phase 2 so that US2, US4, and any story that consumes `IEmailService` can compile and run without US1 being complete first

**Checkpoint**: All domain entities, IEmailService, SMTP adapter, migration, and test fixture are ready. User story implementation may now begin.

---

## Phase 3: User Story 1 — Password Reset (Priority: P1) 🎯 MVP

**Goal**: Users who have forgotten their password can request a reset link via email and set a new password using a single-use, time-limited token.

**Independent Test**: Trigger `POST /api/auth/forgot-password` for a known and unknown email, confirm both return the same response; follow the token URL captured from MailHog HTTP API, submit a new password, and verify login succeeds with the new password and fails with the old one.

### Tests for User Story 1

> ⚠️ **Write these tests FIRST — confirm they FAIL before proceeding to implementation**

- [x] T014 [P] [US1] Write failing tests: `POST /api/auth/forgot-password` returns 200 with identical body for known and unknown email in `backend/WeightTracker.Tests/Integration/Endpoints/PasswordResetEndpointsTests.cs`
- [x] T015 [P] [US1] Write failing tests: `POST /api/auth/forgot-password` for an existing user delivers email to MailHog — assert recipient address, subject contains "reset", body contains token URL in `backend/WeightTracker.Tests/Integration/Endpoints/PasswordResetEndpointsTests.cs`
- [x] T016 [P] [US1] Write failing tests: `POST /api/auth/reset-password` with valid token updates password and login succeeds; token cannot be reused (400 on second use) in `backend/WeightTracker.Tests/Integration/Endpoints/PasswordResetEndpointsTests.cs`
- [x] T017 [P] [US1] Write failing test: `POST /api/auth/reset-password` with expired token returns 400 in `backend/WeightTracker.Tests/Integration/Endpoints/PasswordResetEndpointsTests.cs`

### Implementation for User Story 1

- [x] T018 [P] [US1] Create `IPasswordResetTokenRepository` port (GetActiveByHashAsync, CreateAsync, MarkUsedAsync) in `backend/WeightTracker.Domain/Interfaces/Repositories/IPasswordResetTokenRepository.cs`
- [x] T019 [P] [US1] Create `IPasswordResetService` port (RequestResetAsync, ResetPasswordAsync) in `backend/WeightTracker.Domain/Interfaces/Services/IPasswordResetService.cs`
- [x] T020 [US1] Implement `PasswordResetTokenRepository` in `backend/WeightTracker.Infrastructure/Repositories/PasswordResetTokenRepository.cs` (depends on T018)
- [x] T021 [US1] Implement `PasswordResetService` — generate `RandomNumberGenerator` token, SHA-256 hash for storage, `APP_BASE_URL` link construction, delegate to `IEmailService` — in `backend/WeightTracker.Infrastructure/Services/PasswordResetService.cs` (depends on T019, T020)
- [x] T022 [US1] Add `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` anonymous endpoints to `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs` (depends on T021)
- [x] T023 [US1] Register `IPasswordResetService` → `PasswordResetService` and `IPasswordResetTokenRepository` → `PasswordResetTokenRepository` in `backend/WeightTracker.Api/Program.cs` (note: `IEmailService` → `SmtpEmailService` registered in T013a)

**Checkpoint**: `dotnet test --filter PasswordReset` passes. Password reset flow fully functional end-to-end with MailHog.

---

## Phase 4: User Story 2 — Email Confirmation for New Accounts (Priority: P2)

**Goal**: New users created by admins receive a confirmation email and cannot log in until they confirm their email address.

**Independent Test**: Create an unconfirmed user in the database, attempt login (expect rejection), send confirmation request, follow token URL, attempt login again (expect success).

### Tests for User Story 2

> ⚠️ **Write these tests FIRST — confirm they FAIL before proceeding to implementation**

- [x] T024 [P] [US2] Write failing test: unconfirmed user (`EmailConfirmed = false`) attempting `POST /api/auth/login` receives 401 with "confirm your email" message in `backend/WeightTracker.Tests/Integration/Endpoints/EmailConfirmationEndpointsTests.cs`
- [x] T025 [P] [US2] Write failing tests: `GET /api/auth/confirm-email?token=...` with valid token sets `EmailConfirmed = true` and returns 200; subsequent login succeeds in `backend/WeightTracker.Tests/Integration/Endpoints/EmailConfirmationEndpointsTests.cs`
- [x] T026 [P] [US2] Write failing tests: expired token returns 400; used token returns 400 in `backend/WeightTracker.Tests/Integration/Endpoints/EmailConfirmationEndpointsTests.cs`
- [x] T027 [P] [US2] Write failing test: calling `ResendConfirmationAsync` generates a new token and delivers to MailHog (sets up for US4 admin resend action) in `backend/WeightTracker.Tests/Integration/Endpoints/EmailConfirmationEndpointsTests.cs`

### Implementation for User Story 2

- [x] T028 [P] [US2] Create `IEmailConfirmationTokenRepository` port (GetActiveByHashAsync, CreateAsync, MarkUsedAsync, InvalidatePreviousAsync) in `backend/WeightTracker.Domain/Interfaces/Repositories/IEmailConfirmationTokenRepository.cs`
- [x] T029 [P] [US2] Create `IEmailConfirmationService` port (SendConfirmationAsync, ConfirmAsync, ResendConfirmationAsync) in `backend/WeightTracker.Domain/Interfaces/Services/IEmailConfirmationService.cs`
- [x] T030 [US2] Implement `EmailConfirmationTokenRepository` in `backend/WeightTracker.Infrastructure/Repositories/EmailConfirmationTokenRepository.cs` (depends on T028)
- [x] T031 [US2] Implement `EmailConfirmationService` — token generation, invalidate previous pending token on resend, handle email-change confirmation path — in `backend/WeightTracker.Infrastructure/Services/EmailConfirmationService.cs` (depends on T029, T030)
- [x] T032 [US2] Add `GET /api/auth/confirm-email` endpoint to `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`; update `POST /api/auth/login` to reject with 401 if `EmailConfirmed = false` OR `IsActive = false` — both checks must be added in the same login guard update (depends on T031)
- [x] T033 [US2] Register `IEmailConfirmationService` → `EmailConfirmationService`, `IEmailConfirmationTokenRepository` → `EmailConfirmationTokenRepository` in `backend/WeightTracker.Api/Program.cs`

**Checkpoint**: `dotnet test --filter EmailConfirmation` passes. Unconfirmed users blocked, confirmation flow works end-to-end.

---

## Phase 5: User Story 4 — Admin User Management (Priority: P2)

**Goal**: Admins can list, create, deactivate, reactivate, delete, and assign roles to users. Every action is audit-logged. Admins cannot act on their own account.

**Independent Test**: Log in as admin, exercise each management endpoint against a test user, confirm state changes via user list response and login behaviour.

### Tests for User Story 4

> ⚠️ **Write these tests FIRST — confirm they FAIL before proceeding to implementation**

- [x] T034 [P] [US4] Write failing tests: `GET /api/admin/users` returns user list with all required fields; non-admin returns 403 in `backend/WeightTracker.Tests/Integration/Endpoints/AdminEndpointsTests.cs`
- [x] T035 [P] [US4] Write failing tests: `POST /api/admin/users` creates user with `EmailConfirmed = false` and delivers confirmation email to MailHog in `backend/WeightTracker.Tests/Integration/Endpoints/AdminEndpointsTests.cs`
- [x] T036 [P] [US4] Write failing tests: `POST /api/admin/users/{id}/deactivate` sets `IsActive = false` and `ScheduledDeletionAt`; deactivated user cannot log in in `backend/WeightTracker.Tests/Integration/Endpoints/AdminEndpointsTests.cs`
- [x] T037 [P] [US4] Write failing tests: `POST /api/admin/users/{id}/reactivate` restores `IsActive = true` and clears `ScheduledDeletionAt` in `backend/WeightTracker.Tests/Integration/Endpoints/AdminEndpointsTests.cs`
- [x] T038 [P] [US4] Write failing tests: `DELETE /api/admin/users/{id}` permanently removes user, weight entries, chart settings, and refresh tokens in `backend/WeightTracker.Tests/Integration/Endpoints/AdminEndpointsTests.cs`
- [x] T039 [P] [US4] Write failing tests: `PUT /api/admin/users/{id}/role` assigns role; `POST /api/admin/users/{id}/resend-confirmation` delivers to MailHog in `backend/WeightTracker.Tests/Integration/Endpoints/AdminEndpointsTests.cs`
- [x] T040 [P] [US4] Write failing tests: all admin management actions on own account return 400; each successful action creates an audit log entry in `backend/WeightTracker.Tests/Integration/Endpoints/AdminEndpointsTests.cs`

### Implementation for User Story 4

- [x] T041 [P] Create `IAuditLogRepository` port (AppendAsync, QueryAsync — no Update/Delete methods) in `backend/WeightTracker.Domain/Interfaces/Repositories/IAuditLogRepository.cs`
- [x] T042 [P] Create `IUserManagementService` port (CreateUserAsync, DeactivateUserAsync, ReactivateUserAsync, DeleteUserAsync, AssignRoleAsync, ListUsersAsync) in `backend/WeightTracker.Domain/Interfaces/Services/IUserManagementService.cs`
- [x] T043 Implement `AuditLogRepository` in `backend/WeightTracker.Infrastructure/Repositories/AuditLogRepository.cs` (depends on T041)
- [x] T044 Implement `UserManagementService` — orchestrates user CRUD, grace-period scheduling, self-action guard, audit log writes — in `backend/WeightTracker.Infrastructure/Services/UserManagementService.cs` (depends on T042, T043, IEmailConfirmationService from Phase 4)
- [x] T045 Create `backend/WeightTracker.Api/Endpoints/AdminEndpoints.cs` with routes: `GET /api/admin/users`, `POST /api/admin/users`, `POST /api/admin/users/{id}/deactivate`, `POST /api/admin/users/{id}/reactivate`, `DELETE /api/admin/users/{id}`, `PUT /api/admin/users/{id}/role`, `POST /api/admin/users/{id}/resend-confirmation` — all with `AdminOnly` policy (depends on T044)
- [x] T046 Register `IAuditLogRepository` → `AuditLogRepository` and `IUserManagementService` → `UserManagementService` in `backend/WeightTracker.Api/Program.cs`

**Checkpoint**: `dotnet test --filter Admin` passes. All user management operations work end-to-end with audit logging.

---

## Phase 6: User Story 6 — Automated Deletion of Deactivated Users (Priority: P2)

**Goal**: A daily background service permanently deletes users whose `ScheduledDeletionAt` has passed, atomically removing all associated data.

**Independent Test**: Insert a user with `ScheduledDeletionAt` in the past and one with a future date, call `DeleteExpiredUsersAsync`, confirm only the past-due user and all their data are gone.

### Tests for User Story 6

> ⚠️ **Write these tests FIRST — confirm they FAIL before proceeding to implementation**

- [x] T047 [P] [US6] Write failing tests: `UserDeletionService.DeleteExpiredUsersAsync` deletes users with `ScheduledDeletionAt <= NOW()` and all associated data (weight entries, chart settings, refresh tokens) in `backend/WeightTracker.Tests/Integration/Services/UserDeletionServiceTests.cs`
- [x] T048 [P] [US6] Write failing tests: users with future `ScheduledDeletionAt` and active users (null) are not deleted; reactivated user (null `ScheduledDeletionAt`) is not deleted in `backend/WeightTracker.Tests/Integration/Services/UserDeletionServiceTests.cs`
- [x] T049 [P] [US6] Write failing test: if one user deletion fails, subsequent users are still processed (atomic per user) in `backend/WeightTracker.Tests/Integration/Services/UserDeletionServiceTests.cs`

### Implementation for User Story 6

- [x] T050 [P] Create `IUserDeletionService` port with `DeleteExpiredUsersAsync(CancellationToken)` in `backend/WeightTracker.Domain/Interfaces/Services/IUserDeletionService.cs`
- [x] T051 Implement `UserDeletionService` — query users with `ScheduledDeletionAt <= NOW()`, delete each in a separate transaction — in `backend/WeightTracker.Infrastructure/Services/UserDeletionService.cs` (depends on T050)
- [x] T052 Implement `UserDeletionHostedService` (extends `BackgroundService`) — runs `DeleteExpiredUsersAsync` on startup and every 24 hours; reads `USER_DELETION_GRACE_DAYS` default from config — in `backend/WeightTracker.Infrastructure/Services/UserDeletionHostedService.cs` (depends on T051)
- [x] T053 Register `IUserDeletionService` → `UserDeletionService` and `builder.Services.AddHostedService<UserDeletionHostedService>()` in `backend/WeightTracker.Api/Program.cs`

**Checkpoint**: `dotnet test --filter UserDeletion` passes. Background cleanup service removes expired users with all associated data atomically.

---

## Phase 7: User Story 3 — User Self-Service Account Changes (Priority: P3)

**Goal**: Authenticated users can change their own username, password (with current password verification), and email address (triggers email confirmation to new address; old email active until confirmed).

**Independent Test**: Authenticate as a regular user, call each self-service endpoint, verify the change takes effect (or is pending for email change).

### Tests for User Story 3

> ⚠️ **Write these tests FIRST — confirm they FAIL before proceeding to implementation**

- [x] T054 [P] [US3] Write failing tests: `PUT /api/account/username` updates username; duplicate username returns 400 in `backend/WeightTracker.Tests/Integration/Endpoints/AccountEndpointsTests.cs`
- [x] T055 [P] [US3] Write failing tests: `PUT /api/account/password` with correct current password succeeds; incorrect current password returns 400 in `backend/WeightTracker.Tests/Integration/Endpoints/AccountEndpointsTests.cs`
- [x] T056 [P] [US3] Write failing tests: `PUT /api/account/email` sends confirmation to new address via MailHog; old email still works for login until confirmed; confirming new email switches active address in `backend/WeightTracker.Tests/Integration/Endpoints/AccountEndpointsTests.cs`

### Implementation for User Story 3

- [x] T057 [US3] Create `backend/WeightTracker.Api/Endpoints/AccountEndpoints.cs` with `PUT /api/account/username`, `PUT /api/account/password`, `PUT /api/account/email` — all requiring `RequireAuthorization()` (depends on T054–T056 tests written)
- [x] T058 [US3] Register account endpoint routes in `backend/WeightTracker.Api/Program.cs`

**Checkpoint**: `dotnet test --filter Account` passes. Self-service changes work for all three account fields.

---

## Phase 8: User Story 5 — Admin Audit Log (Priority: P3)

**Goal**: Admins can view a paginated, filterable history of all admin actions. Each entry records action type, actor, target, timestamp, and IP address.

**Independent Test**: Perform three admin actions, call `GET /api/admin/audit-log`, verify all three appear; apply date and action type filters and confirm correct subsets are returned.

### Tests for User Story 5

> ⚠️ **Write these tests FIRST — confirm they FAIL before proceeding to implementation**

- [x] T059 [P] [US5] Write failing tests: `GET /api/admin/audit-log` returns paginated entries with all required fields; `page` and `pageSize` query params work correctly in `backend/WeightTracker.Tests/Integration/Endpoints/AuditLogEndpointsTests.cs`
- [x] T060 [P] [US5] Write failing tests: `fromDate`/`toDate` filter returns only matching entries; `actionType` filter returns only matching action type in `backend/WeightTracker.Tests/Integration/Endpoints/AuditLogEndpointsTests.cs`
- [x] T061 [P] [US5] Write failing test: non-admin user receives 403 from `GET /api/admin/audit-log` in `backend/WeightTracker.Tests/Integration/Endpoints/AuditLogEndpointsTests.cs`

### Implementation for User Story 5

- [x] T062 [US5] Add `GET /api/admin/audit-log` endpoint (with `AdminOnly` policy) to `backend/WeightTracker.Api/Endpoints/AdminEndpoints.cs` — delegates to `IAuditLogRepository.QueryAsync` with filter/pagination (depends on T059–T061 tests written)

**Checkpoint**: `dotnet test --filter AuditLog` passes. Audit log is queryable with pagination and filters.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Frontend API client typings, docker-compose wiring, and full test suite validation.

- [x] T063 [P] Add all new typed functions and response types to `frontend/src/ts/api-client.ts` per `contracts/api.md` (`requestPasswordReset`, `resetPassword`, `confirmEmail`, `changeUsername`, `changePassword`, `changeEmail`, `adminListUsers`, `adminCreateUser`, `adminDeactivateUser`, `adminReactivateUser`, `adminDeleteUser`, `adminAssignRole`, `adminResendConfirmation`, `adminGetAuditLog`, and all corresponding response interfaces)
- [x] T064 [P] Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SENDER_EMAIL`, `APP_BASE_URL`, and `USER_DELETION_GRACE_DAYS` to the `backend` service environment section in `docker-compose.yml`
- [x] T065 Run full backend test suite and confirm all tests pass: `cd backend && dotnet test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user story phases**
- **US1 Password Reset (Phase 3)**: Depends on Phase 2 only — no story dependencies
- **US2 Email Confirmation (Phase 4)**: Depends on Phase 2 only — no story dependencies
- **US4 Admin User Management (Phase 5)**: Depends on Phase 2 + US2 (needs `IEmailConfirmationService`)
- **US6 Auto Deletion (Phase 6)**: Depends on Phase 2 + US4 (needs `ScheduledDeletionAt` set by admin actions)
- **US3 User Self-Service (Phase 7)**: Depends on Phase 2 + US2 (email change uses `IEmailConfirmationService`)
- **US5 Admin Audit Log (Phase 8)**: Depends on Phase 2 + US4 (audit entries created by admin actions)
- **Polish (Phase 9)**: Depends on all story phases complete

### User Story Dependencies

```
Phase 2 (Foundational)
       ↓
    ┌──┴──┬─────────┐
   US1   US2      (others need US2)
         ↓
    ┌────┴────┐
   US4       US3
         ↓
        US6
         ↓
        US5
         ↓
      Phase 9
```

### Within Each User Story

1. Write failing tests for this story (mark [P] tasks run in parallel)
2. Create domain ports / interfaces (mark [P] tasks run in parallel)
3. Implement repositories (depend on ports)
4. Implement services (depend on repositories)
5. Implement endpoints (depend on services)
6. Register in `Program.cs`
7. Confirm tests pass

### Parallel Opportunities

- **Phase 2**: T003–T008 can run in parallel (all different files)
- **US1 tests**: T014–T017 can run in parallel
- **US1 ports**: T018–T019 can run in parallel
- **US2 tests**: T024–T027 can run in parallel
- **US2 ports**: T028–T029 can run in parallel
- **US4 tests**: T034–T040 can run in parallel
- **US4 ports**: T041–T042 can run in parallel
- **US6 tests**: T047–T049 can run in parallel
- **US3 tests**: T054–T056 can run in parallel
- **US5 tests**: T059–T061 can run in parallel
- **Phase 9**: T063–T064 can run in parallel

---

## Parallel Example: User Story 1

```text
# Run all US1 test tasks together (must fail before implementation):
T014: Failing tests for forgot-password anti-enumeration
T015: Failing tests for forgot-password email delivery via MailHog
T016: Failing tests for reset-password success + token invalidation
T017: Failing test for reset-password expired token

# Run both port definitions together:
T018: IPasswordResetTokenRepository
T019: IPasswordResetService

# Then sequentially:
T020: PasswordResetTokenRepository (depends on T018)
T021: PasswordResetService (depends on T019, T020)
T022: AuthEndpoints additions (depends on T021)
T023: Program.cs registration
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Install packages
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 Password Reset
4. **STOP and VALIDATE**: `dotnet test --filter PasswordReset`
5. Deploy/demo — users can reset forgotten passwords

### Incremental Delivery

1. Phase 1 + 2 → Foundation
2. Phase 3 (US1) → Password reset works
3. Phase 4 (US2) → Email confirmation gate in place
4. Phase 5 (US4) → Admin can manage users
5. Phase 6 (US6) → Deactivated users auto-deleted
6. Phase 7 (US3) → Users can self-update account
7. Phase 8 (US5) → Admin audit trail queryable
8. Phase 9 → Polish and validation

---

## Notes

- [P] tasks operate on different files with no cross-task dependencies at that point
- TDD sequence is **non-negotiable**: test → fail → implement → pass
- Commit after each completed phase per constitution commit cadence rules
- `ApiFixture.EnsureTestUserExists` sets `EmailConfirmed = true` so existing tests are unaffected by the new email gate
- The admin test user added in T013 must have role `"admin"` and `EmailConfirmed = true`
- `GenerateTestJwt` extension in T013 should accept a `role` parameter defaulting to `"user"` for backwards compatibility with existing tests
- MailHog HTTP API: `GET http://localhost:{httpPort}/api/v2/messages` returns `{ items: [ { Content: { Headers: { To, Subject }, Body }, ... } ] }`
- `APP_BASE_URL` in tests should be set to a recognizable stub (e.g., `http://localhost:3000`) so tests can assert the token URL appears in email body
