# Implementation Plan: Email Confirmation Page

**Branch**: `013-confirm-email-page` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)

## Summary

Add a public `confirm-email.html` frontend page that automatically calls the existing `GET /api/auth/confirm-email?token=` backend endpoint on load, then displays a success or error state based on the result. The page follows the established DaisyUI + Tailwind card layout used by other public pages (`reset-complete.html`, `reset-request.html`). The backend endpoint is already implemented; this feature is frontend-only. Implementation follows TDD: tests are written first against the exported `initConfirmEmailPage()` function, then the HTML and TypeScript are implemented to make them pass.

## Technical Context

**Language/Version**: TypeScript 5.x (browser target ES2020)
**Primary Dependencies**: Vite 5.x (build), Vitest 2.x + jsdom (tests), Tailwind CSS v3 + DaisyUI v4 (UI), existing `api-client.ts`, `auth-guard.ts`, `config.ts`, `theme.ts`
**Storage**: None — no localStorage, no new DB columns
**Testing**: Vitest 2.x + jsdom (frontend unit tests)
**Target Platform**: Browser (served via nginx:alpine container)
**Project Type**: Web application (frontend only for this feature)
**Performance Goals**: Page must render initial state immediately on load; API call is non-blocking to loading indicator display
**Constraints**: No backend changes; no new npm dependencies; must pass existing lint and test suite
**Scale/Scope**: Single page, single TypeScript module, single test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | spec.md written and validated before planning |
| II. Privacy & Data Ownership | ✅ PASS | No health data involved; the confirmation token is never stored; page is stateless |
| III. Test-First (TDD) | ✅ PASS | Plan mandates failing tests before implementation; test file is a first-class deliverable |
| IV. Incremental Delivery (MVP First) | ✅ PASS | P1 (valid token → success) is independently testable and deliverable; P2/P3/P4 build on it |
| V. Simplicity (YAGNI) | ✅ PASS | No new abstractions, no new dependencies; follows existing page module pattern exactly |

**Post-design re-check**: All gates remain green. No complexity deviations required.

## Project Structure

### Documentation (this feature)

```text
specs/013-confirm-email-page/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-contract.md  # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── confirm-email.html          # NEW: public page
│   └── ts/
│       └── confirm-email.ts        # NEW: page entry module
├── tests/
│   └── confirm-email.test.ts       # NEW: Vitest tests (written first)
└── vite.config.ts                  # MODIFY: add confirmEmail entry point
```

**Structure Decision**: Web application — frontend only. No backend files modified. Follows the existing multi-page Vite setup where each HTML file has a 1:1 corresponding TypeScript entry module and a test file.

## Implementation Phases

### Phase 0: Setup & Test Scaffolding

**Goal**: Register the page and write all failing tests before any implementation.

**Tasks**:

1. Add `confirmEmail: resolve(__dirname, "src/confirm-email.html")` to `vite.config.ts` `rollupOptions.input`
2. Create `frontend/tests/confirm-email.test.ts` with mocks for auth-guard, api-client, config — and failing tests for all acceptance scenarios (see test plan below)
3. Create stub `frontend/src/ts/confirm-email.ts` that exports `initConfirmEmailPage()` returning `Promise.resolve()` — just enough to import without error
4. Verify tests fail for the right reason (stub does nothing)

### Phase 1: HTML Structure

**Goal**: Create the page markup with all required panels.

**Tasks**:

5. Create `frontend/src/confirm-email.html` with:
   - Card layout matching `reset-complete.html` (same `#public-page-root` → `#auth-card` → `.card-body` structure)
   - `#loading-panel` (hidden by default): spinner + "Confirming your email…" text
   - `#success-panel` (hidden by default): success alert with "Your email has been confirmed. You can now sign in." + link to `/login.html`
   - `#error-panel` (hidden by default): error alert containing `#error-message` span + link to `/login.html` + `mailto:` contact support link
   - `<script type="module" src="ts/confirm-email.ts"></script>`

### Phase 2: TypeScript Implementation

**Goal**: Implement `initConfirmEmailPage()` to make all tests pass.

**Tasks**:

6. Implement `initConfirmEmailPage()` in `confirm-email.ts`:
   - Call `initTheme()`, `await loadConfig()`, `await checkAuthStatus()`, `enforceRedirect("public", state)`
   - Read token from `new URLSearchParams(window.location.search).get("token")`
   - If token is absent or empty: unhide `#error-panel`, set `#error-message` to "This confirmation link is missing or invalid. Please use the link from your email." — return
   - Unhide `#loading-panel`
   - Try `await confirmEmail(token)`
   - On success: hide `#loading-panel`, unhide `#success-panel`
   - On error: hide `#loading-panel`, unhide `#error-panel`, set `#error-message` to `err.message` (if `ApiError`) or "Something went wrong. Please try again."
7. Wire `DOMContentLoaded` listener at module bottom

### Phase 3: Verification

**Tasks**:

8. Run `cd frontend && npm test` — all confirm-email tests must pass, existing tests must remain green
9. Run `cd frontend && npm run lint` — no lint errors
10. Run `cd frontend && npm run build` — `confirm-email.html` appears in `dist/`
11. Manual smoke test against running stack: valid token → success; no token → immediate error; invalid token → error after loading

## Test Plan

File: `frontend/tests/confirm-email.test.ts`

| # | Test name | Mocked state | Expected outcome |
|---|-----------|-------------|-----------------|
| 1 | calls checkAuthStatus and enforceRedirect("public") on init | default (no token, unauthenticated) | both called |
| 2 | shows error-panel immediately when no token in URL | `window.location.search = ""` | `#error-panel` visible, `confirmEmail` not called |
| 3 | shows error-panel immediately when token is empty string | `window.location.search = "?token="` | `#error-panel` visible, `confirmEmail` not called |
| 4 | shows loading-panel while request is in flight | token present, `confirmEmail` pending | `#loading-panel` visible |
| 5 | shows success-panel after successful confirmation | token present, `confirmEmail` resolves | `#success-panel` visible, `#loading-panel` hidden |
| 6 | success-panel contains a link to /login.html | same as #5 | anchor href = "/login.html" |
| 7 | shows error-panel after API error | `confirmEmail` rejects with ApiError | `#error-panel` visible, `#error-message` contains error text |
| 8 | error-panel contains a link to /login.html | same as #7 | anchor href = "/login.html" |
| 9 | error-panel contains a contact support link | same as #7 | anchor with `mailto:` href exists |

## Complexity Tracking

No complexity deviations. All implementation follows existing patterns with no new abstractions or dependencies.
