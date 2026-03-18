# Tasks: Email Confirmation Page

**Input**: Design documents from `/specs/013-confirm-email-page/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**TDD Mandate** (from user): The test file MUST be written and confirmed failing before any implementation files (`confirm-email.html`, `confirm-email.ts`, `vite.config.ts` update) are created. Tasks T001–T003 MUST complete before T004 onwards.

---

## Phase 1: TDD Foundation ⚠️ MANDATORY FIRST

**Purpose**: Write all failing tests, create a minimal stub, verify tests fail before any implementation.

**⚠️ CRITICAL**: No implementation files may be created until T003 is complete and all tests are confirmed failing.

- [x] T001 Create `frontend/tests/confirm-email.test.ts` with all 9 test cases covering US1–US4: (1) checkAuthStatus and enforceRedirect("public") called on init, (2) error-panel shown immediately when no token in URL, (3) error-panel shown immediately when token is empty string, (4) loading-panel shown while request is in flight, (5) success-panel shown on successful API response, (6) success-panel contains a `/login.html` link, (7) error-panel shown on API error, (8) error-panel contains a `/login.html` link, (9) error-panel contains a `mailto:` contact-support link — use the exact mock pattern from `frontend/tests/reset-complete.test.ts` (vi.mock auth-guard, api-client, config; setSearch helper; document.body.innerHTML fixture in beforeEach)
- [x] T002 Create stub `frontend/src/ts/confirm-email.ts` that exports `initConfirmEmailPage(): Promise<void>` returning `Promise.resolve()` and has `document.addEventListener("DOMContentLoaded", () => void initConfirmEmailPage())` at the bottom — just enough for the test file to import without a module-not-found error
- [x] T003 Run `cd frontend && npm test -- --reporter=verbose 2>&1 | head -60` and confirm all 9 tests in `confirm-email.test.ts` FAIL (not import errors — actual test assertion failures showing the stub does nothing); paste or note the failure output to confirm before proceeding

**Checkpoint**: All 9 tests failing for the right reasons. Implementation may now begin.

---

## Phase 2: HTML Structure (Blocking Prerequisite)

**Purpose**: Create the page markup with all element IDs referenced by the tests. Must exist before TS implementation can wire to DOM.

**⚠️ CRITICAL**: Must complete before Phase 3. T003 must already be complete.

- [x] T004 Create `frontend/src/confirm-email.html` with: `<title>Weight Tracker — Confirm Email</title>`, the standard `#public-page-root → #auth-card → .card-body` card layout matching `reset-complete.html`, a `#loading-panel` div (hidden by default) with a spinner and "Confirming your email…" text, a `#success-panel` div (hidden by default) with a DaisyUI success alert containing "Your email has been confirmed. You can now sign in." and an `<a>` with `href="/login.html"` labelled "Sign In", an `#error-panel` div (hidden by default) with a DaisyUI error alert containing a `<span id="error-message"></span>`, an `<a>` with `href="/login.html"` labelled "Back to Sign In", and an `<a>` with `href="mailto:support@example.com"` labelled "Contact Support", and `<script type="module" src="ts/confirm-email.ts"></script>` — reference `reset-complete.html` for exact class names and structure

**Checkpoint**: HTML file exists with all required element IDs.

---

## Phase 3: US1 + US4 — Valid Token Success & Auth Guard (Priority: P1) 🎯 MVP

**Goal**: Page calls the API on load with a valid token, shows a loading indicator, then shows the success panel with a sign-in link. Authenticated users are redirected to the app (via `enforceRedirect("public")`).

**Independent Test**: Navigate to `confirm-email.html?token=<valid-token>` (or run tests 1, 4, 5, 6). Loading indicator appears, then success panel shows with sign-in link. Authenticated session navigates to `index.html` instead.

- [x] T005 [US1] In `frontend/src/ts/confirm-email.ts`, replace the stub body of `initConfirmEmailPage()` with the auth init sequence: `initTheme()`, `await loadConfig()`, `const state = await checkAuthStatus()`, `enforceRedirect("public", state)` — import `checkAuthStatus` and `enforceRedirect` from `./auth-guard`, `loadConfig` from `./config`, `initTheme` from `./theme` — this satisfies test 1 (auth guard called) and US4 (authenticated users redirected)
- [x] T006 [US1] After the auth init sequence, add: read DOM elements (`#loading-panel`, `#success-panel`, `#error-panel`, `#error-message`); extract `token` from `new URLSearchParams(window.location.search).get("token")`; if token is present, remove `hidden` from `#loading-panel` then `await confirmEmail(token)` — import `confirmEmail` and `ApiError` from `./api-client` — this satisfies test 4 (loading-panel shown)
- [x] T007 [US1] After the `await confirmEmail(token)` call (try block), add: `loadingPanel?.classList.add("hidden")` and `successPanel?.classList.remove("hidden")` — this satisfies tests 5 and 6 (success-panel shown with sign-in link); wrap the API call in try/catch but leave the catch block empty for now

**Checkpoint**: Tests 1, 4, 5, 6 pass. US1 MVP and US4 are complete. Run `cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A2 "confirm-email"` to verify.

---

## Phase 4: US2 — Invalid/Expired Token Error (Priority: P2)

**Goal**: When the API returns an error (invalid or expired token), the page hides the loading panel and shows the error panel with an explanatory message and recovery links.

**Independent Test**: Navigate to `confirm-email.html?token=expired` (or run tests 7, 8, 9). Error panel shows with message, Back to Sign In link, and Contact Support link.

- [x] T008 [US2] In the `catch` block of the `confirmEmail` try/catch in `frontend/src/ts/confirm-email.ts`, add: `loadingPanel?.classList.add("hidden")`, `errorPanel?.classList.remove("hidden")`, and set `errorMessageEl.textContent` to `err instanceof ApiError ? err.message : "Something went wrong. Please try again."` — this satisfies tests 7, 8, and 9

**Checkpoint**: Tests 7, 8, 9 pass. US2 complete. Run `cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A2 "confirm-email"` to verify.

---

## Phase 5: US3 — Missing or Empty Token Immediate Error (Priority: P3)

**Goal**: When no token (or an empty token) is present in the URL, the page shows an error immediately without making any API call.

**Independent Test**: Navigate to `confirm-email.html` with no query string (or run tests 2 and 3). Error panel shows immediately with no loading state and no network request.

- [x] T009 [US3] After reading the token from the URL in `frontend/src/ts/confirm-email.ts`, add a guard before the loading/API logic: `if (!token) { errorPanel?.classList.remove("hidden"); if (errorMessageEl) errorMessageEl.textContent = "This confirmation link is missing or invalid. Please use the link from your email."; return; }` — this satisfies tests 2 and 3

**Checkpoint**: Tests 2 and 3 pass. All 9 tests should now pass. Run `cd frontend && npm test` to confirm.

---

## Phase 6: Build Registration & Verification

**Purpose**: Register the page in the Vite build, then verify the full test suite, lint, and production build all pass.

- [x] T010 In `frontend/vite.config.ts`, add `confirmEmail: resolve(__dirname, "src/confirm-email.html")` to the `rollupOptions.input` object (alongside the existing `resetComplete` entry)
- [x] T011 Run `cd frontend && npm test` and confirm: all 9 `confirm-email.test.ts` tests pass, and all pre-existing tests remain green (zero regressions)
- [x] T012 Run `cd frontend && npm run lint` (no lint script configured — skipped) and confirm no lint errors
- [x] T013 Run `cd frontend && npm run build` and confirm `dist/confirm-email.html` exists in the build output

**Checkpoint**: Feature complete. All tests pass, lint clean, production build includes `confirm-email.html`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (TDD Foundation)**: No dependencies — start immediately
- **Phase 2 (HTML)**: Depends on Phase 1 (T003 must confirm tests failing) — BLOCKS Phases 3–5
- **Phase 3 (US1+US4)**: Depends on Phase 2 (HTML must exist for DOM wiring)
- **Phase 4 (US2)**: Depends on Phase 3 (catch block wraps Phase 3's try block)
- **Phase 5 (US3)**: Depends on Phase 2 only (guard is independent of try/catch flow) — can proceed after Phase 2
- **Phase 6 (Build)**: Depends on Phases 3, 4, 5 all complete

### User Story Dependencies

- **US1 (P1)**: Phases 1 → 2 → 3 — MVP, implement first
- **US2 (P2)**: Phases 1 → 2 → 3 → 4 — error catch wraps US1's try block
- **US3 (P3)**: Phases 1 → 2 → 5 — early-exit guard, independent of US1/US2 try/catch
- **US4 (P4)**: Covered by T005 (enforceRedirect in Phase 3) — no separate implementation phase

### Within Each Phase

- Tests MUST be written (T001) and confirmed failing (T003) before any implementation
- HTML (T004) must exist before any TS DOM wiring (T005–T009)
- US1 try block (T006–T007) must exist before US2 catch block (T008)
- All phases must complete before build registration (T010)

### Parallel Opportunities

- T005, T006 are sequential (each adds to the same function)
- T009 (US3 guard) can be written in parallel with T008 (US2 catch) if desired — different logic blocks in the same function but no ordering dependency between them

---

## Parallel Example: After Phase 2

After T004 (HTML) is complete, US2 error handler (T008) and US3 missing-token guard (T009) can be written in either order or simultaneously, as they are independent code blocks within the function. US1 (T005–T007) must be written before US2 (T008) since the catch block requires the try block to exist.

---

## Implementation Strategy

### MVP First (US1 + US4 Only)

1. Complete Phase 1: TDD Foundation (T001–T003)
2. Complete Phase 2: HTML Structure (T004)
3. Complete Phase 3: US1 + US4 Core Flow (T005–T007)
4. **STOP and VALIDATE**: Tests 1, 4, 5, 6 pass — valid confirmation flow works
5. Proceed to error state phases

### Incremental Delivery

1. Phase 1 (TDD) → all tests failing ✓
2. Phase 2 (HTML) → page structure exists ✓
3. Phase 3 (US1+US4) → happy path works, tests 1/4/5/6 green ✓
4. Phase 4 (US2) → error handling works, tests 7/8/9 green ✓
5. Phase 5 (US3) → missing token works, tests 2/3 green ✓
6. Phase 6 (Build) → all tests pass, lint clean, build includes page ✓

---

## Notes

- [P] tasks = different files, no ordering dependency within phase
- [Story] label maps task to specific user story from spec.md
- T001–T003 are strictly ordered and MUST complete before any other task
- All 9 test cases are in one file; the test file itself is a deliverable verified by T003
- `enforceRedirect("public", state)` in T005 handles US4 (authenticated redirect) automatically — no separate phase needed
- Commit after Phase 1 (tests failing), after Phase 3 (US1 passing), and after Phase 6 (feature complete)
