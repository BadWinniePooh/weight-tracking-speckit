# Tasks: Confirm Email → Password Setup Redirect

**Input**: Design documents from `/specs/014-confirm-email-password-setup/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**TDD Mandate**: Backend integration test and frontend tests must be written/updated and confirmed failing before any implementation. T001–T002 (backend TDD) and T003–T004 (frontend TDD) are hard gates.

---

## Phase 1: Backend TDD Foundation ⚠️ MANDATORY FIRST

**Purpose**: Write the new backend integration test and confirm it fails before any backend implementation.

**⚠️ CRITICAL**: No backend implementation (T005–T009) may begin until T002 confirms the test is failing.

- [x] T001 Add test method `ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken` to `backend/WeightTracker.Tests/Integration/Endpoints/EmailConfirmationEndpointsTests.cs` — use the existing `CreateUnconfirmedUserAsync` + `SendConfirmationAsync` + `ExtractTokenFromEmailBody` helpers already in the class; call `GET /api/auth/confirm-email?token=<token>`; assert `HttpStatusCode.OK`; deserialise response as `JsonElement`; assert `passwordResetToken` property is present and its string value is not null or empty
- [x] T002 Run `cd backend && dotnet test --filter "ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken" 2>&1` and confirm the test **FAILS** (assertion on missing `passwordResetToken` property); note the failure output before proceeding

**Checkpoint**: Backend integration test confirmed failing. Backend implementation may now begin.

---

## Phase 2: Frontend TDD Foundation ⚠️ MANDATORY FIRST

**Purpose**: Update the two success-path tests in the existing test file and confirm they fail before any frontend implementation.

**⚠️ CRITICAL**: No frontend implementation (T010–T011) may begin until T004 confirms the tests are failing.

- [x] T003 Update `frontend/tests/confirm-email.test.ts`: (a) change the `confirmEmail` mock in `vi.mock("../src/ts/api-client")` from `mockResolvedValue(undefined)` to `mockResolvedValue({ message: "Email confirmed.", passwordResetToken: "test-reset-token" })`; (b) add a `window.location` mock using `Object.defineProperty(window, "location", { value: { href: "", search: "?token=valid-token-abc" }, writable: true, configurable: true })` in the `setSearch` helper or `beforeEach` (similar to reset-complete.test.ts); (c) update test 5 (`shows success-panel and hides loading-panel...`) to instead assert `window.location.href === "/reset-complete.html?token=test-reset-token"`; (d) update test 6 (`success-panel contains a link to /login.html`) to instead assert `window.location.href` contains `/reset-complete.html?token=`
- [x] T004 Run `cd frontend && npx vitest run tests/confirm-email.test.ts --reporter=verbose 2>&1` and confirm tests 5 and 6 **FAIL** (old implementation shows success-panel instead of redirecting); confirm all other tests (1–4, 7–9) still pass; note the failure output before proceeding

**Checkpoint**: Frontend tests 5 and 6 confirmed failing. Frontend implementation may now begin.

---

## Phase 3: US1 — New User Sets Password After Confirmation (Priority: P1) 🎯 MVP

**Goal**: Confirmation endpoint returns `passwordResetToken` in success response; confirmation page redirects to `/reset-complete.html?token=<passwordResetToken>` on success.

**Independent Test**: Backend — `ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken` passes. Frontend — tests 5 and 6 pass and full suite stays green.

### Backend Implementation

- [x] T005 [P] [US1] Amend `backend/WeightTracker.Domain/Interfaces/Services/IEmailConfirmationService.cs`: change `Task<bool> ConfirmAsync(string token)` to `Task<Guid?> ConfirmAsync(string token)` — returns confirmed user's `Id` on success, `null` on failure
- [x] T006 [P] [US1] Amend `backend/WeightTracker.Domain/Interfaces/Services/IPasswordResetService.cs`: add method `Task<string> CreateResetTokenAsync(Guid userId)` to the interface
- [x] T007 [US1] Amend `backend/WeightTracker.Infrastructure/Services/EmailConfirmationService.cs`: update `ConfirmAsync` to return `user.Id` (instead of `true`) on the success paths and `null` (instead of `false`) on the failure paths — depends on T005
- [x] T008 [US1] Amend `backend/WeightTracker.Infrastructure/Services/PasswordResetService.cs`: implement `CreateResetTokenAsync(Guid userId)` — generate 32 random bytes, Base64Url-encode to plaintext, SHA256-hash for storage, create and persist a `PasswordResetToken` record with `TokenExpiryHours` expiry, return plaintext — reuse the existing private `Base64UrlEncode` and `HashToken` methods in the same class — depends on T006
- [x] T009 [US1] Amend `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs`: update the `GET /api/auth/confirm-email` handler to inject `IPasswordResetService passwordResetService`; call `var confirmedUserId = await emailConfirmationService.ConfirmAsync(token)`; if `confirmedUserId is null` return `Results.Json(new { error = "..." }, statusCode: 400)`; else call `var resetToken = await passwordResetService.CreateResetTokenAsync(confirmedUserId.Value)` and return `Results.Ok(new { message = "Email confirmed. You may now log in.", passwordResetToken = resetToken })` — depends on T007 and T008
- [x] T010 [P] [US1] Run `cd backend && dotnet test 2>&1` — all tests must pass including `ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken`; existing tests must remain green

### Frontend Implementation

- [x] T011 [P] [US1] Amend `frontend/src/ts/api-client.ts`: add `export interface ConfirmEmailResponse { message: string; passwordResetToken: string; }` and change `confirmEmail(token: string): Promise<void>` to `confirmEmail(token: string): Promise<ConfirmEmailResponse>` with the request call updated to `request<ConfirmEmailResponse>(...)`
- [x] T012 [US1] Amend `frontend/src/ts/confirm-email.ts`: in the try block, store the result of `await confirmEmail(token)` in a `response` variable; replace the success-panel show logic with: check `response.passwordResetToken` — if falsy, show error panel with message "Email confirmed but setup link could not be generated. Please contact support."; if present, do `loadingPanel?.classList.add("hidden")` then `window.location.href = '/reset-complete.html?token=' + encodeURIComponent(response.passwordResetToken)` — depends on T011
- [x] T013 [US1] Run `cd frontend && npm test 2>&1` — all 9 tests in confirm-email.test.ts must pass including the updated tests 5 and 6; full 353-test suite must stay green

**Checkpoint**: US1 complete. Full onboarding flow works end-to-end: confirm email → auto-redirect to password setup.

---

## Phase 4: US2 — Confirmation Failure Error States Unchanged (Priority: P2)

**Goal**: Verify that all error paths on the confirmation page remain exactly as before — no regression.

**Independent Test**: All error-state tests (1–4, 7–9) in confirm-email.test.ts still pass; backend 400 tests still pass.

- [x] T014 [US2] Verify `cd backend && dotnet test --filter "ConfirmEmail_ExpiredToken_Returns400" 2>&1` passes — error path returns 400 unchanged; if failing, investigate and fix before proceeding
- [x] T015 [US2] Verify `cd backend && dotnet test --filter "ConfirmEmail_UsedToken_Returns400" 2>&1` passes — used-token path returns 400 unchanged
- [x] T016 [US2] Verify `cd frontend && npx vitest run tests/confirm-email.test.ts --reporter=verbose 2>&1` shows tests 2, 3, 7, 8, 9 all pass — missing token, empty token, API error states all unchanged

**Checkpoint**: All error states verified. US2 regression check complete.

---

## Phase 5: Polish & Verification

**Purpose**: Full suite verification and build check.

- [x] T017 Run `cd backend && dotnet test 2>&1` — full backend suite must pass with zero failures
- [x] T018 Run `cd frontend && npm test 2>&1` — full frontend suite (353+ tests) must pass with zero failures
- [x] T019 Run `cd frontend && npm run build 2>&1` — production build must succeed with no errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Backend TDD)**: No dependencies — start immediately
- **Phase 2 (Frontend TDD)**: No dependencies — can run in parallel with Phase 1
- **Phase 3 (US1 Backend)**: Depends on Phase 1 (T002 confirmed failing)
- **Phase 3 (US1 Frontend)**: Depends on Phase 2 (T004 confirmed failing)
- **Phase 4 (US2 Regression)**: Depends on Phase 3 complete
- **Phase 5 (Polish)**: Depends on Phase 4 complete

### Within Phase 3 — Backend Task Order

- T005 and T006 are independent (different interface files) — can run in parallel
- T007 depends on T005 (implements the new interface)
- T008 depends on T006 (implements the new interface)
- T009 depends on both T007 and T008 (endpoint uses both services)
- T010 depends on T009 (full compile + test)

### Within Phase 3 — Frontend Task Order

- T011 (api-client) must complete before T012 (confirm-email.ts uses the updated type)
- T013 depends on T012

### Parallel Opportunities

- **Phase 1 and Phase 2** can run in parallel — backend and frontend TDD setup are independent
- **T005 and T006** can run in parallel — different interface files
- **T007 and T008** can run in parallel after T005/T006 respectively — different implementation files
- **T010 and T011** can run in parallel after their respective prerequisites — backend test run and frontend api-client change are independent

---

## Parallel Example: Phase 3 Backend

```
After Phase 1 gate (T002 confirmed failing):
  → T005 (IEmailConfirmationService.cs) in parallel with T006 (IPasswordResetService.cs)
  → T007 (EmailConfirmationService.cs) after T005
  → T008 (PasswordResetService.cs) after T006
  → T009 (AuthEndpoints.cs) after both T007 and T008
  → T010 (dotnet test) after T009
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Backend TDD (T001–T002)
2. Complete Phase 2: Frontend TDD (T003–T004) — can overlap with Phase 1
3. Complete Phase 3: US1 implementation (T005–T013)
4. **STOP and VALIDATE**: Full end-to-end flow works; all new tests pass
5. Proceed to Phase 4 regression check

### Incremental Delivery

1. Phases 1 + 2 (TDD setup) → all target tests failing ✓
2. Phase 3 (US1) → success flow complete; tests 5 and 6 green; backend new test green ✓
3. Phase 4 (US2) → error states verified; zero regressions ✓
4. Phase 5 (Polish) → full suites green; build clean ✓

---

## Notes

- [P] tasks = different files, no ordering dependency within phase
- [Story] label maps task to specific user story from spec.md
- T001–T002 (backend gate) and T003–T004 (frontend gate) MUST complete before their respective implementation tasks
- The `setSearch` helper in confirm-email.test.ts already sets `window.location` via `Object.defineProperty` — T003 extends this to also control `href` for redirect assertions
- The existing `ConfirmEmail_ValidToken_SetsConfirmedAndLoginSucceeds` test checks only `body.GetProperty("message")`, not the absence of other fields — it will continue to pass after the endpoint change
- Commit after Phase 1+2 (TDD gates confirmed), after Phase 3 (US1 complete), after Phase 5 (feature verified)
