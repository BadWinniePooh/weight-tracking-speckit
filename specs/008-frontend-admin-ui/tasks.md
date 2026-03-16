# Tasks: Frontend Admin UI and User-Facing Pages

**Input**: Design documents from `/specs/008-frontend-admin-ui/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: TDD is **non-negotiable** per spec and constitution. For every implementation file, a failing test MUST be written first, confirmed to fail, then implementation written to make it pass.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Wire the new pages into the build system. Must complete before any new page can be loaded or tested via the dev server.

- [x] T001 Add 4 new Vite entry points (`resetRequest`, `resetComplete`, `profile`, `admin`) to `frontend/vite.config.ts` — see `contracts/frontend.md` for exact keys and paths

**Checkpoint**: `npm run build` in `frontend/` produces output for all new pages.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Role-aware auth guard is the shared dependency for all new pages. Every page entry file calls `enforceRedirect` with a new page type. This phase MUST be complete before any user story page can be implemented.

**⚠️ CRITICAL**: No user story page work can begin until this phase is complete.

- [x] T002 [P] Write failing tests for `getUserRole()` in `frontend/tests/auth-token.test.ts` — cover: null when no token, null on malformed token, returns role string from ASP.NET Core URI claim, fallback to shorthand `"role"` key; confirm tests FAIL before T004
- [x] T003 [P] Write failing tests for extended `enforceRedirect` (`"profile"`, `"admin"`, `"public"` page types) and `AuthState.role` field in `frontend/tests/auth-guard.test.ts` — cover all redirect permutations per `contracts/frontend.md`; confirm tests FAIL before T005
- [x] T004 Implement `getUserRole(): string | null` in `frontend/src/ts/auth-token.ts` — decode JWT payload via `atob`, check both `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` and `"role"` keys, never throw; confirm T002 tests PASS
- [x] T005 Extend `AuthState` (add `role?: string`) and `enforceRedirect` (add `"profile"`, `"admin"`, `"public"` page types) in `frontend/src/ts/auth-guard.ts`; update `checkAuthStatus()` to populate `role` via `getUserRole()` after successful refresh; confirm T003 tests PASS

**Checkpoint**: All auth-guard and auth-token tests green. Role-aware redirect logic is ready for use by all new page entry files.

---

## Phase 3: User Story 1 — Admin User Management (Priority: P1) 🎯 MVP

**Goal**: Authenticated admin users can view, create, and manage all user accounts from a protected dashboard. Stats bar shows derived totals. All mutations update the table in place.

**Independent Test**: Load `admin.html` as an authenticated admin user, verify the user table renders, exercise deactivate/reactivate/delete/change-role/resend actions, verify create user modal adds a row. Verify non-admin and unauthenticated users are redirected.

### Tests for User Story 1

> **Write these tests FIRST — confirm they FAIL before writing any of T007/T008**

- [x] T006 Write failing tests for `admin.ts` user management in `frontend/tests/admin.test.ts` — cover: stats bar values derived from user list (`totalUsers`, `activeSessions`), user table renders all columns, deactivate/reactivate/delete/change-role/resend buttons trigger correct `api-client` calls, `window.confirm` called before destructive actions, confirm dialog returns false → no API call is made and the user row is unchanged, own-account actions disabled, create user modal opens on button click, create user form submission calls `adminCreateUser` and prepends row; confirm tests FAIL before T008

### Implementation for User Story 1

- [x] T007 [P] Create `frontend/src/admin.html` — includes full page markup: stats bar (`#stats-total-users`, `#stats-active-sessions`), user management table (`#user-table-body`, `#create-user-btn`), create user `<dialog>` (`#create-user-modal`, `#create-user-form`, `#cu-username`, `#cu-email`, `#cu-role`, `#cu-feedback`), audit log section with table and controls (markup only — see `contracts/frontend.md` for all required element IDs); references `ts/admin.ts` as module script
- [x] T008 Implement `frontend/src/ts/admin.ts` — `enforceRedirect("admin", state)` as first action; load user list via `adminListUsers()`; derive and render stats; render user table rows with `data-user-id` and `data-action` attributes; wire deactivate/reactivate/delete/change-role/resend via event delegation using `window.confirm` for destructive actions; disable own-account actions with `title` tooltip; wire create user button to open `<dialog>`; wire create user form submit to call `adminCreateUser` and prepend new row; confirm T006 tests PASS

**Checkpoint**: `admin.html` fully functional for user management. Stats bar, table, all per-row actions, and create user modal work. Admin auth guard enforces role.

---

## Phase 4: User Story 2 — Admin Audit Log (Priority: P2)

**Goal**: Admin dashboard gains a paginated, filterable audit log section showing `actorUsername` and `targetUsername` resolved server-side. Backend amended to join Users table. Frontend renders the data.

**Independent Test**: View audit log section on `admin.html`, apply date range and action-type filters, navigate pages, verify `actorUsername` column shows a username string (not a UUID).

### Tests for User Story 2

> **Backend test first (xUnit) — confirm FAIL before T010/T011. Frontend test additions — confirm FAIL before T014.**

- [x] T009 Add failing integration tests for `actorUsername`/`targetUsername` fields in `backend/WeightTracker.Tests/Integration/Endpoints/AuditLogEndpointsTests.cs` — assert every audit log entry response includes a non-null, non-empty `actorUsername` string; assert `targetUsername` is null for entries with no target user; confirm tests FAIL before T010
- [x] T010 Amend `QueryAsync` in `backend/WeightTracker.Infrastructure/Repositories/AuditLogRepository.cs` — add LEFT JOINs to `Users` table on `ActorUserId` and `TargetUserId`; project `ActorUsername` and `TargetUsername` into result; confirm T009 tests still FAIL (endpoint not yet updated)
- [x] T011 Update audit log `Results.Ok(...)` projection in `backend/WeightTracker.Api/Endpoints/AdminEndpoints.cs` to include `actorUsername` and `targetUsername` from the amended repository result; confirm T009 backend tests PASS
- [x] T012 [P] Update `AuditLogEntryDto` interface in `frontend/src/ts/api-client.ts` — add `actorUsername: string` and `targetUsername: string | null` fields per `contracts/api-amendment.md`
- [x] T013 Extend `frontend/tests/admin.test.ts` with audit log section tests — cover: audit table renders `actorUsername` from DTO (not UUID), date range and action-type filter inputs trigger `adminGetAuditLog` with correct params, next/previous buttons increment/decrement page, page indicator updates, empty state shown when entries array is empty; confirm new tests FAIL before T014
- [x] T014 Implement audit log section in `frontend/src/ts/admin.ts` — `adminGetAuditLog({ page: _auditPage, pageSize: 20, ...filters })` on load; render audit table rows using `actorUsername` and `targetUsername`; wire filter apply button; wire prev/next pagination buttons; update page indicator; show empty state when entries is empty; confirm T013 tests PASS

**Checkpoint**: Audit log section fully functional. Backend returns `actorUsername`/`targetUsername`. Frontend displays correct usernames, filters apply correctly, pagination works.

---

## Phase 5: User Story 3 — Password Reset Flow (Priority: P3)

**Goal**: Any visitor can request a password reset and complete it via a tokenised link. Both pages are publicly accessible. Login page gains a "Forgot password?" link.

**Independent Test**: Submit the reset-request form (any email), verify the same success message always appears. Navigate to reset-complete with a token query parameter, submit new password, verify redirect to login on success and error message on invalid token.

### Tests for User Story 3

> **Write tests FIRST — confirm FAIL before T017 and T020**

- [x] T015 [P] Write failing tests for `reset-request.ts` in `frontend/tests/reset-request.test.ts` — cover: `enforceRedirect("public", state)` called; form submit calls `requestPasswordReset(email)`; success message shown for both 200 and 4xx responses (anti-enumeration); network error shows generic error; submit button disabled during in-flight request; confirm tests FAIL before T017
- [x] T018 [P] Write failing tests for `reset-complete.ts` in `frontend/tests/reset-complete.test.ts` — cover: `enforceRedirect("public", state)` called; token read from URL `?token=` param; missing token shows `#token-error-msg` and disables submit; password mismatch shows client-side error without API call; 200 response redirects to `/login.html`; 400 response shows error in `#feedback-msg`; confirm tests FAIL before T020

### Implementation for User Story 3

- [x] T016 [P] Create `frontend/src/reset-request.html` — email input form, feedback div, submit button; references `ts/reset-request.ts` as module script; see `contracts/frontend.md` for required element IDs
- [x] T019 [P] Create `frontend/src/reset-complete.html` — new password + confirm password inputs, feedback div, token-error div, submit button; references `ts/reset-complete.ts` as module script; see `contracts/frontend.md` for required element IDs
- [x] T017 Implement `frontend/src/ts/reset-request.ts` — `enforceRedirect("public", state)` as first action; wire form submit to call `requestPasswordReset(email)`; always show fixed success message (never vary by response code); disable submit during request; confirm T015 tests PASS
- [x] T020 Implement `frontend/src/ts/reset-complete.ts` — `enforceRedirect("public", state)` as first action; read `token` from `URLSearchParams`; if absent, show `#token-error-msg` and disable submit; client-side password match validation; call `resetPassword(token, newPassword)` on submit; redirect to `/login.html` on 200; show error in `#feedback-msg` on 400; confirm T018 tests PASS
- [x] T021 Add `<a href="/reset-request.html" id="forgot-password-link">Forgot password?</a>` below the sign-in form in `frontend/src/login.html`

**Checkpoint**: Password reset flow fully functional end-to-end. Both pages publicly accessible, login page has link.

---

## Phase 6: User Story 4 — User Profile Self-Service (Priority: P4)

**Goal**: Authenticated users can change their username, email, and password from a dedicated profile page. All three form sections provide inline feedback without page reload. Header navigation gains a Profile link.

**Independent Test**: Load `profile.html` as an authenticated user, submit each of the three forms, verify inline success/error messages appear without reload. Unauthenticated user is redirected to login.

### Tests for User Story 4

> **Write tests FIRST — confirm FAIL before T024**

- [x] T022 Write failing tests for `profile.ts` in `frontend/tests/profile.test.ts` — cover: `enforceRedirect("profile", state)` called; username form calls `changeUsername(newUsername)` and shows `#username-feedback`; email form calls `changeEmail(newEmail)` and shows confirmation notice in `#email-feedback`; password form calls `changePassword(currentPassword, newPassword)` and shows `#password-feedback`; password mismatch shows error without API call; API errors shown inline; no page reload on any submission; confirm tests FAIL before T024

### Implementation for User Story 4

- [x] T023 [P] Create `frontend/src/profile.html` — three independent form sections (change username, change email, change password) each with inputs and a feedback div; references `ts/profile.ts` as module script; see `contracts/frontend.md` for required element IDs
- [x] T024 Implement `frontend/src/ts/profile.ts` — `enforceRedirect("profile", state)` as first action; wire username form to `changeUsername()`; wire email form to `changeEmail()` with confirmation notice in feedback; wire password form to `changePassword()` with client-side confirm-password match check; all feedback inline, no page reload; confirm T022 tests PASS

**Checkpoint**: Profile page fully functional. All three self-service sections work with inline feedback. Unauthenticated users redirected.

---

## Phase 7: User Story 5 — Admin Navigation Link (Priority: P5)

**Goal**: Main app header shows a Profile link for all authenticated users and an Admin Dashboard link visible only to admins.

**Independent Test**: Load `index.html` as admin — both Profile and Admin Dashboard links visible. Load as non-admin — only Profile link visible, Admin Dashboard link absent.

### Tests for User Story 5

> **Write tests FIRST — confirm FAIL before T027**

- [x] T025 Extend `frontend/tests/main.test.ts` with navigation visibility tests — cover: `#nav-admin` hidden when `state.role !== "admin"`; `#nav-admin` visible when `state.role === "admin"`; `#nav-profile` always visible for authenticated users; confirm new tests FAIL before T027

### Implementation for User Story 5

- [x] T026 [P] Add `<a href="/profile.html" id="nav-profile">Profile</a>` and `<a href="/admin.html" id="nav-admin" hidden>Admin Dashboard</a>` to `<header>` in `frontend/src/index.html`
- [x] T027 Update `frontend/src/ts/main.ts` — after `checkAuthStatus()`, if `state.role === "admin"` remove `hidden` attribute from `#nav-admin`; confirm T025 tests PASS

**Checkpoint**: Navigation links complete. Admin Dashboard link conditional on role.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification sweep across all user stories.

- [x] T028 Run full frontend test suite (`npm test` in `frontend/`) — all tests must pass with no failures or skips
- [x] T029 Verify production build includes all new pages (`npm run build` in `frontend/`; confirm `dist/` contains `reset-request`, `reset-complete`, `profile`, `admin` HTML files)
- [x] T030 Run backend tests filtering to audit log (`dotnet test --filter AuditLog` in `backend/`) — all tests including the new `actorUsername`/`targetUsername` assertions must pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user story pages
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 3 (shares `admin.ts`) — backend amendment tasks T009–T011 can start independently in parallel with Phase 3
- **US3 (Phase 5)**: Depends on Phase 2 completion — independent of US1/US2
- **US4 (Phase 6)**: Depends on Phase 2 completion — independent of US1/US2/US3
- **US5 (Phase 7)**: Depends on Phase 2 completion — independent of US3/US4; logically after US1 since admin dashboard must exist
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Unblocked after Phase 2
- **US2 (P2)**: Depends on US1 (shared `admin.ts` and `admin.html`); backend tasks T009–T011 can start after Phase 1
- **US3 (P3)**: Unblocked after Phase 2 — no dependency on US1/US2
- **US4 (P4)**: Unblocked after Phase 2 — no dependency on US1/US2/US3
- **US5 (P5)**: Unblocked after Phase 2 — no dependency on US3/US4

### Within Each Phase

- Test tasks MUST be written before implementation tasks and MUST be confirmed FAILING
- HTML files `[P]` may be created in parallel with test writing
- Implementation tasks depend on the corresponding test task completing (confirmed FAIL)

### Parallel Opportunities

- T002 and T003 (auth-token and auth-guard test writing) — parallel, different files
- T004 and T005 depend sequentially (T004 first, T005 extends auth-guard calling getUserRole)
- T009 backend test and T015/T018 reset page tests — parallel across backend/frontend
- T015 and T018 (reset-request and reset-complete test writing) — parallel
- T016 and T019 (reset-request.html and reset-complete.html creation) — parallel
- T022 and T023 (profile test and profile.html) — parallel
- T025 and T026 (main.test.ts nav extension and index.html update) — parallel

---

## Parallel Execution Examples

### Phase 2: Foundational

```
Parallel: T002 (auth-token tests) + T003 (auth-guard tests)
Then sequential: T004 (auth-token impl) → T005 (auth-guard impl)
```

### Phase 5: US3 Password Reset

```
Parallel: T015 (reset-request tests) + T018 (reset-complete tests)
         + T016 (reset-request.html) + T019 (reset-complete.html)
Then: T017 (reset-request.ts impl) + T020 (reset-complete.ts impl) [parallel, different files]
Then: T021 (login.html link)
```

### Phase 4: US2 Audit Log — Backend + Frontend in parallel

```
Parallel: T009 (backend test) starting alongside Phase 3 US1 work
Then: T010 → T011 (backend amendment sequential)
Parallel with T011: T012 (api-client type update) + T013 (extend admin.test.ts)
Then: T014 (audit log impl in admin.ts)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T005)
3. Complete Phase 3: US1 Admin User Management (T006–T008)
4. **STOP and VALIDATE**: Admin dashboard user table fully functional
5. Demonstrate: admin can view, create, and manage all users

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Phase 3 → Admin user management (MVP)
3. Phase 4 → Admin audit log (complete admin dashboard)
4. Phase 5 → Password reset flow (any visitor can reset password)
5. Phase 6 → User profile self-service (all authenticated users)
6. Phase 7 → Navigation links (polish/discoverability)
7. Phase 8 → Polish and verification

---

## Notes

- `[P]` tasks write to different files with no incomplete-task dependencies — safe to run concurrently
- Every test task MUST be confirmed FAILING before the corresponding implementation task begins (TDD)
- Backend amendment tasks (T009–T011) can be worked in parallel with Phase 3 frontend work
- `admin.html` is created once in T007 with full markup for both US1 and US2 sections; `admin.ts` is extended in T014 (US2 audit log logic added)
- Commit after each completed phase per constitution commit cadence rules
