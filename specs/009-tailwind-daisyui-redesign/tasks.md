# Tasks: Tailwind CSS + DaisyUI UI Redesign

**Input**: Design documents from `/specs/009-tailwind-daisyui-redesign/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ui-components.md ✅, quickstart.md ✅

**Tests**: US7 requires test-suite refactoring (existing tests updated to stable selectors). Dedicated failing-test tasks are included before each non-trivial logic implementation (navbar.ts, bug fixes FR-028/030/031) per Constitution Principle III.

**Organization**: Tasks are grouped by user story. US7 (Test Stability) is a non-negotiable P1 prerequisite — no HTML changes until Phase 2 completes and all tests pass.

**Bug fixes**: FR-028 (stats bar live refresh), FR-029 (Create User modal centering), FR-030 (audit log full datetime), FR-031 (email change notice with actual address) are woven into the appropriate phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (touches different files, no blocking dependency)
- **[Story]**: User story label (US1–US7)

---

## Phase 1: Setup (Tailwind + DaisyUI Toolchain)

**Purpose**: Install and configure the new styling toolchain. No HTML or TypeScript changes yet.

- [x] T001 Install devDependencies in `frontend/package.json`: run `npm install -D tailwindcss@3 postcss autoprefixer daisyui@4` from `frontend/`
- [x] T002 [P] Create `frontend/tailwind.config.js` with content globs `["./src/**/*.{html,ts}", "./tests/**/*.ts"]`, DaisyUI plugin, themes `["light --default", "dark --prefersdark"]`, `logs: false` (per `quickstart.md` Step 2)
- [x] T003 [P] Create `frontend/postcss.config.js` with plugins: `tailwindcss: {}`, `autoprefixer: {}` (per `quickstart.md` Step 3)
- [x] T004 Replace `frontend/src/css/main.css`: add `@tailwind base/components/utilities` directives; add `[data-theme="light"]` and `[data-theme="dark"]` custom property overrides for all 13 color tokens from `data-model.md` Design Token Inventory; retain `#chart-container` height-only rule (no DaisyUI equivalent); remove all other hand-written CSS
- [x] T005 Run `npm run build` in `frontend/` — build must succeed with Tailwind CSS output in `dist/`
- [x] T006 Run `npm test` in `frontend/` — all existing tests must pass before any HTML changes

**Checkpoint**: Tailwind + DaisyUI toolchain active; build green; tests green.

---

## Phase 2: Foundational — US7: Stable DOM Identifiers (Priority: P1)

**Purpose**: Add stable `data-*` identifiers to dynamically generated elements and refactor
`ui.test.ts` to query only via `id`/`data-*` selectors. **Hard prerequisite for all HTML work.**

**⚠️ CRITICAL**: No HTML styling changes can begin until T017 confirms a clean `npm test` run.

**Independent Test**: `npm test` — all tests pass; zero CSS class selectors (`.className`) remain in `frontend/tests/ui.test.ts`.

- [x] T007 [US7] In `frontend/src/ts/ui.ts`, add `data-cell="weight"` to the weight `<td>` of each dynamically generated entry table row (per `contracts/ui-components.md` Entry Table Row contract)
- [x] T008 [US7] In `frontend/src/ts/ui.ts`, add `data-cell="date"` to the date `<td>` of each dynamically generated entry table row
- [x] T009 [US7] In `frontend/src/ts/ui.ts`, add `data-cell="time"` to the time `<td>` of each dynamically generated entry table row
- [x] T010 [US7] In `frontend/src/ts/ui.ts`, add `data-cell="actions"` to the actions `<td>` of each dynamically generated entry table row
- [x] T011 [US7] In `frontend/src/ts/ui.ts`, add `id="entry-empty-state"` to the empty-state element rendered when no weight entries exist
- [x] T012 [US7] In `frontend/tests/ui.test.ts`, replace all `.entry-weight` class selectors with `[data-cell="weight"]` (~5 occurrences at lines 437, 473, 479, 485, 492)
- [x] T013 [US7] In `frontend/tests/ui.test.ts`, replace all `.entry-date` class selectors with `[data-cell="date"]` (~2 occurrences at lines 443, 499)
- [x] T014 [US7] In `frontend/tests/ui.test.ts`, replace all `.entry-time` class selectors with `[data-cell="time"]` (~2 occurrences at lines 449, 505)
- [x] T015 [US7] In `frontend/tests/ui.test.ts`, replace all `.entry-actions` class selectors with `[data-cell="actions"]` (~1 occurrence at line 455)
- [x] T016 [US7] In `frontend/tests/ui.test.ts`, replace all `.empty-state` class selectors with `#entry-empty-state` id selector (~2 occurrences at lines 553, 559)
- [x] T017 [US7] Run `npm test` in `frontend/` — all tests must pass; confirm no `.querySelector(".[a-z]")` CSS-class queries remain in `frontend/tests/` (grep check)

**Checkpoint**: All tests green. Zero CSS class selectors in test suite. HTML styling work may now begin.

---

## Phase 3: US1 — Consistent Visual Identity Across All Pages (Priority: P1) 🎯 MVP

**Goal**: All 7 pages share the same DaisyUI component classes, health/fitness palette, and
typography. Every interactive element uses `btn`, `input`, `card`, or equivalent DaisyUI classes.

**Independent Test**: Load `login.html` and `index.html`. Both pages use the same emerald/teal
primary color, same font stack, and same input/button visual treatment. `npm test` passes.

- [x] T018 [US1] Verify `frontend/src/css/main.css` palette overrides cover all 13 tokens from `data-model.md` Design Token Inventory for both `[data-theme="light"]` and `[data-theme="dark"]`; add any missing token overrides
- [x] T019 [P] [US1] Apply DaisyUI form classes to `frontend/src/login.html` — `input input-bordered w-full` on username/password inputs; `btn btn-primary w-full` on submit; `label` + `label-text` on field labels; preserve all existing `id` attributes
- [x] T020 [P] [US1] Apply DaisyUI form classes to `frontend/src/setup.html` — same pattern; preserve all existing `id` attributes
- [x] T021 [P] [US1] Apply DaisyUI form classes to `frontend/src/reset-request.html` — same pattern; preserve all existing `id` attributes
- [x] T022 [P] [US1] Apply DaisyUI form classes to `frontend/src/reset-complete.html` — same pattern; preserve all existing `id` attributes
- [x] T023 [P] [US1] Apply DaisyUI component classes to `frontend/src/index.html` main content — `card bg-base-100 shadow` + `card-body` for weight entry form; `input input-bordered` on weight input; `select select-bordered` on unit selector; `btn btn-primary` on add button; `table table-zebra w-full` on history table; `btn btn-sm btn-ghost text-error` on delete buttons
- [x] T024 [P] [US1] Apply DaisyUI component classes to `frontend/src/profile.html` main content — `card bg-base-100 shadow` + `card-body` for each form section (display name, email, password); `input input-bordered w-full` on all inputs; `btn btn-primary` on save buttons
- [x] T025 [P] [US1] Apply DaisyUI `table table-zebra w-full` and `overflow-x-auto` wrapper to user management table and audit log table in `frontend/src/admin.html`; apply `card bg-base-100 shadow` + `card-body` wrappers to each admin section
- [x] T026 [US1] Run `npm run build` and `npm test` in `frontend/` — verify build succeeds and all tests pass

**Checkpoint**: All 7 pages use DaisyUI component classes. Consistent palette and typography. Tests green.

---

## Phase 4: US2 — Persistent Responsive Navigation (Priority: P1)

**Goal**: All three authenticated pages have a DaisyUI navbar — horizontal on desktop (≥ 768px),
hamburger on mobile (< 768px). Role-based admin link visibility. Logout unchanged.

**Independent Test**: Load `index.html` at 1280px — horizontal navbar with all links. At 375px —
hamburger visible; click reveals nav items. Admin link absent for `user` role, present for `admin`.

> **NOTE: Write T027 test first, ensure it FAILS before implementing T028.**

- [x] T027 [US2] Write failing Vitest tests in `frontend/tests/navbar.test.ts` for `navbar.ts` behavior: (a) `#nav-admin` and `#nav-mobile-admin` are `hidden` when user role is `"user"`; (b) `#nav-admin` and `#nav-mobile-admin` are visible when role is `"admin"`; (c) `aria-current="page"` is set on the `#nav-dashboard` link when `activePage` is `"dashboard"`; (d) clicking `#nav-hamburger` removes `hidden` from `#nav-mobile-menu`; (e) clicking `#nav-hamburger` again adds `hidden` back. Tests MUST fail before T028.
- [x] T028 [US2] Create `frontend/src/ts/navbar.ts` — export `initNavbar(activePage: "dashboard"|"profile"|"admin")`: reads user role from `auth-guard.ts`/`auth-token.ts`, sets `hidden` on `#nav-admin` and `#nav-mobile-admin` if role is not `admin`, sets `aria-current="page"` on the matching desktop and mobile nav link for `activePage`, adds click handler on `#nav-hamburger` to toggle `hidden` on `#nav-mobile-menu`
- [x] T029 [P] [US2] Add DaisyUI navbar HTML to `frontend/src/index.html` — `<nav id="main-navbar" class="navbar bg-base-100 shadow-sm">` containing: `<a id="nav-brand">Weight Tracker</a>`; `<ul id="nav-links-desktop">` with `<a id="nav-dashboard">`, `<a id="nav-profile">`, `<a id="nav-admin" hidden>`; `<button id="logout-button">` (EXISTING — preserve); `<button id="nav-hamburger" aria-label="Open navigation menu">`; add `<div id="nav-mobile-menu" hidden>` with `<ul id="nav-links-mobile">` containing `id="nav-mobile-dashboard"`, `id="nav-mobile-profile"`, `id="nav-mobile-admin" hidden`, `id="nav-mobile-logout"` — per `contracts/ui-components.md` Navbar contract
- [x] T030 [P] [US2] Add same DaisyUI navbar HTML to `frontend/src/profile.html` — `id="nav-profile"` is the active link
- [x] T031 [P] [US2] Add same DaisyUI navbar HTML to `frontend/src/admin.html` — `id="nav-admin"` is the active link; preserve all existing stats/table/audit-log HTML below the navbar
- [x] T032 [US2] In `frontend/src/ts/index.ts` (or `main.ts`), import `theme.ts` and `navbar.ts` and call `initTheme()` + `initNavbar("dashboard")` on DOMContentLoaded
- [x] T033 [US2] In `frontend/src/ts/profile.ts`, import `theme.ts` and `navbar.ts` and call `initTheme()` + `initNavbar("profile")` on DOMContentLoaded
- [x] T034 [US2] In `frontend/src/ts/admin.ts`, import `theme.ts` and `navbar.ts` and call `initTheme()` + `initNavbar("admin")` on DOMContentLoaded
- [x] T035 [US2] Run `npm run build` and `npm test` in `frontend/` — verify build and all tests pass; manually verify hamburger toggle at < 768px using browser DevTools

**Checkpoint**: All authenticated pages have working role-aware responsive navbar. Logout unchanged. Tests green (including T027 navbar tests).

---

## Phase 5: US4 — Centered Card Layout for Public Pages (Priority: P2)

**Goal**: All 4 public pages display a focused fullscreen-centered card with no navbar.

**Independent Test**: Load `login.html` at 320px and 1280px — centered card renders; no navbar; no horizontal scroll. Repeat for all 4 pages.

- [x] T036 [US3] Create `frontend/src/ts/theme.ts` — export `initTheme()`: reads `window.matchMedia("(prefers-color-scheme: dark)")`, sets `document.documentElement.setAttribute("data-theme", "dark"|"light")`; registers `addEventListener("change", ...)` for live switching without page reload (per `research.md` Finding 3); call `initTheme()` immediately on module load so theme applies before first paint
- [x] T037 [P] [US4] Wrap `frontend/src/login.html` in public card layout: outer `<div id="public-page-root" class="min-h-screen flex items-center justify-center bg-base-200">` + inner `<div id="auth-card" class="card w-full max-w-md bg-base-100 shadow-xl"><div class="card-body">`; add `<h2 id="page-title" class="card-title">Log In</h2>`; add `<script type="module">` importing `theme.ts` `initTheme()` if no dedicated TS entry point; preserve all existing form field `id` attributes (per `contracts/ui-components.md` Public Page Card contract)
- [x] T038 [P] [US4] Wrap `frontend/src/setup.html` in public card layout — same structure; `id="page-title"` text: "Set Up Account"; preserve all existing `id` attributes; import `theme.ts`
- [x] T039 [P] [US4] Wrap `frontend/src/reset-request.html` in public card layout — `id="page-title"` text: "Reset Password"; preserve existing ids; import `theme.ts`
- [x] T040 [P] [US4] Wrap `frontend/src/reset-complete.html` in public card layout — `id="page-title"` text: "Set New Password"; preserve existing ids; import `theme.ts`
- [x] T041 [US4] Run `npm run build` and `npm test` in `frontend/` — verify build and tests pass

**Checkpoint**: All 4 public pages show centered card layout with no navbar. Tests green.

---

## Phase 6: US3 — OS Dark/Light Mode Preference (Priority: P2)

**Goal**: Both themes are visually complete on all 7 pages. OS preference drives the scheme. Live switching without page reload.

**Independent Test**: Chrome DevTools → Rendering → emulate `prefers-color-scheme: dark`. All 7 pages fully styled in dark scheme. Switch back to light — light scheme. No unstyled elements in either mode.

- [x] T042 [US3] Audit all 7 HTML pages for unthemed elements in dark mode: using Chrome DevTools Rendering emulation, inspect each page for any element using browser-default colors rather than DaisyUI token values; fix any such elements in `frontend/src/*.html` or `frontend/src/css/main.css`
- [x] T043 [US3] Verify live theme switching without page reload: with the app open in a browser, toggle OS dark/light preference (macOS System Preferences → Appearance, or Chrome DevTools emulation); confirm `data-theme` attribute on `<html>` updates in real time via the `theme.ts` change listener; fix `theme.ts` if not working

**Checkpoint**: Both themes visually complete on all 7 pages. Live switching functional. Tests green.

---

## Phase 7: US5 — Rich Interactive Feedback (Priority: P2)

**Goal**: All forms show inline error styling; destructive actions use a DaisyUI modal dialog;
API calls show button loading states; hover/focus states are distinct on all interactive elements.

Also addresses **FR-031** (email change notice shows actual address).

**Independent Test**: On `index.html`, submit empty form — inline error appears with error color. Trigger API call — submit button enters loading state. On `admin.html`, trigger deactivation — DaisyUI modal dialog appears (not `window.confirm()`). On `profile.html`, change email — notice shows actual new email address.

- [x] T044 [US5] Add DaisyUI `<dialog>` confirmation modal to `frontend/src/admin.html`: `<dialog id="confirm-modal" class="modal">` containing `<div class="modal-box">`, `<h3 id="confirm-modal-title" class="font-bold text-lg">`, `<p id="confirm-modal-message" class="py-4">`, `<div class="modal-action">` with `<button id="confirm-modal-yes" class="btn btn-error">Confirm</button>` and `<button id="confirm-modal-cancel" class="btn">Cancel</button>` — per `contracts/ui-components.md` Confirmation Modal contract
- [x] T045 [US5] Update `frontend/src/ts/admin.ts` to use the `<dialog>` API for the confirmation modal: replace any `hidden`-toggle open/close with `confirmModal.showModal()` / `confirmModal.close()` for `#confirm-modal`; update `window.confirm()` calls to use the modal dialog; update `window.confirm` mock expectations in `frontend/tests/admin.test.ts` to mock `dialog.showModal()` **before** wiring the new dialog logic
- [x] T046 [P] [US5] In `frontend/src/ts/admin.ts`, apply loading state to all action buttons: set `disabled` + `data-loading="true"` + `loading` CSS class on the triggering button before each API call; remove all three on completion — per `contracts/ui-components.md` Loading Button State contract
- [x] T047 [P] [US5] In `frontend/src/ts/index.ts` (or `main.ts`), apply loading state pattern to the weight-entry submit button (`#submit-btn`) during the add/delete API calls; in `frontend/src/ts/profile.ts` apply to all profile form submit buttons
- [x] T048 [P] [US5] In `frontend/src/ts/login.ts` and `frontend/src/ts/reset-request.ts` and `frontend/src/ts/reset-complete.ts` and `frontend/src/ts/setup.ts`, apply loading state pattern to their respective submit buttons during API calls
- [x] T049 [US5] Verify all form error display elements in `frontend/src/*.html` use DaisyUI error styling: ensure `#error-msg`, `#error-message`, `#cu-feedback`, `#username-feedback`, and any other error elements have `text-error text-sm` class or use the `label-text-alt text-error` DaisyUI pattern; update any that still use hand-written error color classes
- [x] T050 [US5] Write failing Vitest test in `frontend/tests/profile.test.ts` for the email change confirmation notice: assert that after submitting an email change form with value `"new@example.com"`, the confirmation notice element contains the string `"new@example.com"` (not generic text like "your new address"). Test MUST fail before T052.
- [x] T051 [US5] Run `npm run build` and `npm test` in `frontend/` — verify build and all tests pass at this intermediate checkpoint (T050 failing test is expected to fail; verify it fails for the right reason: notice does not yet include the email)
- [x] T052 [US5] **FR-031** — In `frontend/src/ts/profile.ts`, update the email change confirmation notice: replace the generic message "A confirmation email has been sent to your new address" with `"A confirmation email has been sent to ${newEmail}"` where `newEmail` is read from the email input field value at time of form submission
- [x] T053 [US5] Run `npm run build` and `npm test` in `frontend/` — all tests must pass including T050's scenario; verify T050 test now passes

**Checkpoint**: Confirmation modal functional. Loading states visible. Error styling DaisyUI-based. Email notice shows actual address. Tests green.

---

## Phase 8: US6 — Admin Page: Stats, Badges, Tables, Audit Log (Priority: P3)

**Goal**: `admin.html` is fully styled — DaisyUI stats bar, color-coded status badges, zebra-striped tables, and styled audit log controls with pagination.

Also addresses **FR-029** (Create User modal centering), **FR-028** (stats bar live refresh after mutations), and **FR-030** (audit log full datetime in local timezone).

**Independent Test**: Load `admin.html` as admin. Stats bar visually distinct. User table zebra-striped with color-coded badges. Create user, then verify stats bar updates without page reload. Audit log timestamps show `YYYY-MM-DD HH:mm` in user's local timezone. Create User dialog is centered.

> **NOTE: Write T055 and T061 tests first, ensure they FAIL before implementing T056–T057 and T062 respectively.**

- [x] T054 [US6] Apply DaisyUI stats component to `frontend/src/admin.html` stats section: `<div class="stats shadow w-full stats-vertical lg:stats-horizontal">` with `<div class="stat">` children each containing `<div class="stat-title">`, `<div class="stat-value" id="stat-total-users">`, `<div class="stat-desc">` for total users and `<div class="stat-value" id="stat-active-sessions">` for active sessions
- [x] T055 [US6] Write failing Vitest tests in `frontend/tests/admin.test.ts` for stats bar live refresh: (a) after calling the create-user mutation handler, `#stat-total-users` text content reflects the incremented count; (b) after deactivate/reactivate, `#stat-active-sessions` text content reflects the updated active count; (c) assertions pass without re-initializing the full page (DOM persists between mutation and assertion). Tests MUST fail before T056.
- [x] T056 [US6] In `frontend/src/ts/admin.ts`, create a `refreshStats(users: AdminUserDto[])` helper that reads the user array and updates `#stat-total-users` (count of all users) and `#stat-active-sessions` (count where `hasActiveSession === true`) in-place
- [x] T057 [US6] **FR-028** — In `frontend/src/ts/admin.ts`, call `refreshStats()` after every successful mutating API response: create user, delete user, deactivate user, reactivate user — re-fetch the user list via `adminListUsers()` then pass the result to `refreshStats()` (no page reload)
- [x] T058 [US6] **FR-029** — Add DaisyUI `<dialog>` Create User modal to `frontend/src/admin.html`: `<dialog id="create-user-modal" class="modal">` containing `<div class="modal-box">` wrapping the existing create-user form fields (move `#cu-username`, `#cu-email`, `#cu-role`, `#cu-feedback`, `#cu-submit-btn` inside the modal-box); update `frontend/src/ts/admin.ts` to use `createUserModal.showModal()` / `createUserModal.close()`; this fixes top-left positioning via DaisyUI flex centering
- [x] T059 [US6] In `frontend/src/ts/admin.ts`, update the status badge render in the user table row to emit DaisyUI badge classes with `data-status` attribute: `<span data-status="active" class="badge badge-success">Active</span>`, `<span data-status="inactive" class="badge badge-error">Deactivated</span>`, `<span data-status="pending" class="badge badge-warning">Pending</span>` — per `contracts/ui-components.md` Status Badge contract
- [x] T060 [P] [US6] Apply `table table-zebra w-full` and `overflow-x-auto` wrapper to the user management `<table>` in `frontend/src/admin.html`
- [x] T061 [US6] Write failing Vitest test in `frontend/tests/admin.test.ts` for audit log timestamp formatting: assert that a timestamp value like `"2026-03-16T14:30:00Z"` renders in the audit log timestamp cell as a 16-character string matching the `YYYY-MM-DD HH:mm` pattern (e.g., `"2026-03-16 14:30"`). Test MUST fail before T062 (current implementation renders date only).
- [x] T062 [US6] **FR-030** — In `frontend/src/ts/admin.ts`, update the audit log timestamp cell render: replace date-only formatting with full local datetime using `new Date(ts).toLocaleString("sv-SE", { timeZoneName: undefined }).slice(0, 16)` (produces `YYYY-MM-DD HH:mm` in the user's local timezone); verify output matches the `YYYY-MM-DD HH:mm` pattern
- [x] T063 [P] [US6] Apply `table table-zebra w-full` and `overflow-x-auto` wrapper to the audit log `<table>` in `frontend/src/admin.html`; apply `select select-bordered select-sm`, `input input-bordered input-sm`, `btn btn-sm btn-primary` to audit filter controls; apply `join` + `btn btn-sm btn-ghost` to pagination Previous/Next buttons
- [x] T064 [US6] Run `npm run build` and `npm test` in `frontend/` — all tests must pass including T055 and T061 scenarios; verify T055 and T061 tests now pass

**Checkpoint**: Admin page fully styled. Stats bar refreshes live. Audit log shows full datetime. Create User modal centered. All bug fixes (FR-028–FR-031) implemented. Tests green.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Design system documentation, final CSS cleanup, and end-to-end verification.

- [x] T065 [P] Create `docs/design-system.md` documenting: (1) color palette — all 13 DaisyUI tokens, light + dark values, usage column (per `data-model.md`); (2) typography — system font stack, heading scale; (3) component usage guidelines — which DaisyUI classes to use for buttons, inputs, cards, badges, tables, modals, navbar; (4) spacing/layout conventions — public card layout vs. authenticated navbar layout; (5) icon usage policy — inline SVG Heroicons only, no npm dependency; (6) rationale for emerald/teal primary + amber accent, DaisyUI light/dark themes as base, no manual theme toggle (per `research.md` Findings 3–4)
- [x] T066 [P] Audit `frontend/src/css/main.css`: confirm only `@tailwind` directives, design token overrides, and `#chart-container` height rule remain; remove any residual hand-written CSS that duplicates DaisyUI utility behavior
- [x] T067 Run `npm test` in `frontend/` — full test suite must pass with zero regressions; grep `frontend/tests/` for `.querySelector(".[a-z]")` — must return zero matches
- [x] T068 Run `npm run build` in `frontend/` — production build must succeed with no errors; CSS bundle must contain Tailwind-purged utilities only
- [ ] T069 [P] Verify responsive layout at 320px, 768px, 1280px for all 7 pages using Chrome DevTools device emulation — no horizontal scroll; navbar shows correctly at each breakpoint (hamburger < 768px, horizontal bar ≥ 768px)
- [ ] T070 [P] Verify dark mode completeness: toggle OS to dark mode and inspect all 7 pages — no unstyled elements, no default browser colors visible in either theme

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (US7 — Stable Identifiers) ◄── HARD GATE: must be 100% complete before any HTML work
        ├─► Phase 3 (US1 — Visual Identity)       ─┐
        ├─► Phase 4 (US2 — Responsive Navbar)      │ Can run in any order after Phase 2
        ├─► Phase 5 (US4 — Public Card Layout)      │ Each story is independently testable
        ├─► Phase 6 (US3 — Dark/Light Mode)         │ (recommended priority order: US1→US2→US4→US3→US5→US6)
        ├─► Phase 7 (US5 — Interactive Feedback)    │
        └─► Phase 8 (US6 — Admin Styling)          ─┘
              └─► Phase 9 (Polish)
```

### User Story Dependencies

| Story | Depends On | Notes |
|-------|-----------|-------|
| US7 (Phase 2) | Phase 1 complete | Hard gate — BLOCKS all HTML phases |
| US1 (Phase 3) | Phase 2 complete | Independent — can start immediately after US7 |
| US2 (Phase 4) | Phase 2 complete | T027 failing tests written first; T028 (`navbar.ts`) second |
| US4 (Phase 5) | Phase 2 complete | 4 HTML files all independent of each other |
| US3 (Phase 6) | Phase 2 + `theme.ts` created (T036 in Phase 5) | Verification after all pages styled |
| US5 (Phase 7) | Phase 2 complete; Phase 4 (US2) recommended first | T050 failing test written before T052 |
| US6 (Phase 8) | Phase 2 complete; T044 (US5 confirm-modal HTML) | T055 and T061 failing tests written before implementations |
| Polish (Phase 9) | All desired phases complete | — |

### Bug Fix Placement

| Bug Fix | FR | Task(s) | Phase |
|---------|-----|---------|-------|
| Stats bar live refresh | FR-028 | T055 (test), T056–T057 (impl) | Phase 8 (US6) |
| Create User modal centering | FR-029 | T058 | Phase 8 (US6) |
| Audit log full datetime | FR-030 | T061 (test), T062 (impl) | Phase 8 (US6) |
| Email change notice with actual address | FR-031 | T050 (test), T052 (impl) | Phase 7 (US5) |

---

## Parallel Execution Examples

### Phase 2 (US7) — sequential data-attribute additions (same file)

```
[T007] ui.ts: data-cell="weight"
[T008] ui.ts: data-cell="date"        All edit ui.ts — run sequentially
[T009] ui.ts: data-cell="time"
[T010] ui.ts: data-cell="actions"
[T011] ui.ts: id="entry-empty-state"
```

### Phase 3 (US1) — 7 parallel page styling streams

```
[T019] login.html DaisyUI classes
[T020] setup.html DaisyUI classes
[T021] reset-request.html DaisyUI classes
[T022] reset-complete.html DaisyUI classes
[T023] index.html DaisyUI classes
[T024] profile.html DaisyUI classes
[T025] admin.html table classes
All converge → [T026] build + test
```

### Phase 4 (US2) — failing test first, then 3 parallel HTML updates

```
[T027] Write failing tests for navbar.ts  ← sequential first (must fail)
[T028] Create navbar.ts  ← sequential (implement until T027 tests pass)
[T029] index.html navbar
[T030] profile.html navbar   } Parallel after T028
[T031] admin.html navbar
[T032–T034] TS entry point imports  } Parallel
[T035] build + test  ← sequential last
```

### Phase 8 (US6) — failing tests first, then admin sections

```
[T054] Stats bar HTML  ← sequential first
[T055] Write failing tests for stats refresh  ← sequential (must fail)
[T056] refreshStats() helper
[T057] FR-028 call refreshStats after mutations  } sequential (implements T055 test)
[T058] FR-029 Create User modal
[T059] status badge render
[T060] user table table-zebra   } parallel
[T063] audit log table + filters
[T061] Write failing test for datetime  ← sequential (must fail)
[T062] FR-030 datetime format  ← sequential (implements T061 test)
[T064] build + test  ← sequential last
```

---

## Implementation Strategy

### MVP (P1 Stories: US7 + US1 + US2)

1. Phase 1: Install toolchain
2. Phase 2: US7 — stable identifiers (critical gate)
3. Phase 3: US1 — visual identity on all pages
4. Phase 4: US2 — responsive navbar on authenticated pages (T027 failing tests first)
5. **STOP + VALIDATE**: All P1 stories complete; all 7 pages styled; navbar works; both themes visible

### Full Delivery (All Stories)

Continue from MVP:
6. Phase 5: US4 — public card layout
7. Phase 6: US3 — dark/light mode verified
8. Phase 7: US5 — interactive feedback + FR-031 email notice (T050 failing test first)
9. Phase 8: US6 — admin styling + FR-028/029/030 bug fixes (T055 and T061 failing tests first)
10. Phase 9: Polish + design-system.md

### Single-Developer Sequential Order

T001 → T002/T003/T004 (parallel) → T005 → T006 → T007–T011 → T012–T016 → T017 → T018 → T019–T025 (parallel) → T026 → T027 → T028 → T029–T031 (parallel) → T032–T034 → T035 → T036 → T037–T040 (parallel) → T041 → T042–T043 → T044 → T045 → T046–T048 (parallel) → T049 → T050 → T051 → T052 → T053 → T054 → T055 → T056 → T057 → T058 → T059 → T060/T063 (parallel) → T061 → T062 → T064 → T065–T066/T069–T070 (parallel) → T067 → T068

---

## Notes

- **[P]** tasks touch different files — safe to parallelize within the same phase
- **T007–T011 are sequential** — all edit `frontend/src/ts/ui.ts`; no [P] marker
- US7 (Phase 2) is a constitutional requirement — spec marks it P1 and "non-negotiable prerequisite"; never skip or defer
- `#logout-button` id must be preserved across all navbar implementations — existing tests depend on it
- `#chart-container` must not have DaisyUI card classes applied directly — only its surrounding `<section>` wrapper
- Call `initTheme()` as early as possible in each TS entry point (before other init calls) to prevent flash of wrong theme on load
- `window.confirm()` calls in `admin.ts` must be replaced (T045) — update `window.confirm` mock expectations in `admin.test.ts` **before** wiring the dialog logic (T045 instructions cover both steps atomically)
- Failing test tasks (T027, T050, T055, T061) must genuinely fail before their paired implementation tasks; verify each fails for the right reason before proceeding
