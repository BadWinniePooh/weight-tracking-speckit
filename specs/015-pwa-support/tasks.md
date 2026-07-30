# Tasks: PWA Support

**Input**: Design documents from `/specs/015-pwa-support/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, contracts/manifest-contract.md ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- TDD applies: write failing tests **before** implementation

---

## Phase 1: Setup

**Purpose**: Install dependency and create icon assets that all stories depend on.

- [x] T001 Add `vite-plugin-pwa` to devDependencies in `frontend/package.json` and run `npm install` in `frontend/`
- [x] T00X [P] Create placeholder 192×192 PNG icon at `frontend/public/icons/icon-192.png`
- [x] T00X [P] Create placeholder 512×512 PNG icon at `frontend/public/icons/icon-512.png`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Write all failing acceptance tests before any plugin configuration. TDD gate — these tests MUST fail before Phase 3 begins.

**⚠️ CRITICAL**: No user story work can begin until T004 exists and all assertions are confirmed failing.

- [x] T00X Create `tests/pwa/pwa-build.test.ts` with failing Vitest assertions:
  - `dist/manifest.webmanifest` exists and is valid JSON
  - Manifest contains `name`, `short_name`, `start_url`, `display: "standalone"`, and `icons` with at least two entries
  - Both `dist/icons/icon-192.png` and `dist/icons/icon-512.png` exist
  - `dist/sw.js` exists
  - All 8 dist HTML files (`index.html`, `login.html`, `setup.html`, `reset-request.html`, `reset-complete.html`, `confirm-email.html`, `profile.html`, `admin.html`) contain a SW registration script reference

**Checkpoint**: Tests exist and fail — foundation ready for user story implementation.

---

## Phase 3: User Story 1 — Android Install (Priority: P1) 🎯 MVP

**Goal**: Chrome on Android offers an install prompt; app launches in standalone mode.

**Independent Test**: Run `npm run build` in `frontend/`, then `npm test` from repo root — all assertions in `tests/pwa/pwa-build.test.ts` pass. Optionally open the deployed app in Chrome on Android and confirm the install banner appears.

- [x] T00X [US1] Configure VitePWA plugin in `frontend/vite.config.ts`:
  - `registerType: 'autoUpdate'`
  - `strategies: 'generateSW'`
  - `workbox: { globPatterns: [] }` (no asset precaching — installability only)
  - `manifest` block with all fields from `contracts/manifest-contract.md`: `name`, `short_name`, `start_url`, `scope`, `display: 'standalone'`, `theme_color`, `background_color`, `icons` (192 + 512 PNG entries)
- [x] T00X [US1] Run `cd frontend && npm run build` from repo root and then `npm test` — confirm all assertions in `tests/pwa/pwa-build.test.ts` pass and no test failures remain
- [x] T00X [US1] Verify manifest fields match Chrome Android installability invariants in `contracts/manifest-contract.md` — cross-check built `dist/manifest.webmanifest` against the contract (name, short_name, start_url, display, icons with correct sizes and type)

**Checkpoint**: All PWA build tests pass. US1 (Android) and US2 (Desktop) installability is fully delivered — same manifest + SW serves both platforms.

---

## Phase 4: User Story 2 — Desktop Install (Priority: P2)

**Goal**: Chrome and Edge desktop show an install icon in the address bar.

**Independent Test**: Open the app URL in Chrome desktop after deploying; confirm install icon appears in address bar. No additional build changes required — same manifest and SW from Phase 3 serves desktop.

> **Note**: US2 shares the exact same underlying implementation as US1. This phase is a verification-only phase confirming the existing artifacts satisfy desktop installability with no additional implementation work.

- [x] T00X [US2] Confirm `tests/pwa/pwa-build.test.ts` tests cover all desktop Chrome/Edge installability requirements (same fields as Android: `display`, `icons`, `start_url`) — add any missing assertions if gaps identified

**Checkpoint**: US2 complete. Desktop installability verified by existing build tests.

---

## Phase 5: User Story 3 — iOS Home Screen (Priority: P3)

**Goal**: Safari on iOS renders the correct app icon and name when added to home screen; launches in standalone-like mode.

**Independent Test**: Add apple-specific meta tags, build, and confirm assertions in `tests/pwa/pwa-build.test.ts` verify all 8 dist HTML files contain the required Apple meta tags.

- [x] T00X [P] [US3] Add apple-specific meta tags to all 8 HTML source files in `frontend/src/` (`index.html`, `login.html`, `setup.html`, `reset-request.html`, `reset-complete.html`, `confirm-email.html`, `profile.html`, `admin.html`) — tags required:
  - `<link rel="apple-touch-icon" href="/icons/icon-192.png">`
  - `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
  - `<meta name="apple-mobile-web-app-title" content="WeightTracker">`
- [x] T01X [US3] Add assertions to `tests/pwa/pwa-build.test.ts` verifying all 8 dist HTML files contain `apple-touch-icon` link and `apple-mobile-web-app-capable` meta tag
- [x] T01X [US3] Run `cd frontend && npm run build && npm test` — confirm new iOS assertions pass alongside all existing tests

**Checkpoint**: All three user stories complete. iOS home screen support verified by build tests.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T01X Run full frontend test suite (`cd frontend && npm test`) to confirm no regressions across all existing tests
- [x] T01X Review and update `specs/015-pwa-support/quickstart.md` if any implementation details diverge from the documented steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately; T002 and T003 are parallel
- **Foundational (Phase 2)**: Depends on T001 (package installed) before tests can import node fs correctly; BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 1 + Phase 2 (icons exist, tests written and failing)
- **US2 (Phase 4)**: Depends on Phase 3 completion (same artifacts)
- **US3 (Phase 5)**: Depends on Phase 3 completion (build already working); T009 is parallelizable across the 8 HTML files
- **Polish (Phase 6)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 1+2 — no dependency on US2 or US3
- **US2 (P2)**: Delivered by US1 — only verification work remains
- **US3 (P3)**: Can start independently after Phase 3 — additive HTML changes only

### Within Each User Story

- T004 (tests) MUST be written and confirmed **failing** before T005 (implementation)
- T005 (plugin config) before T006 (build verification)
- T009 (HTML changes) before T010 (test assertions for iOS) before T011 (verify)

### Parallel Opportunities

- T002 + T003 (icon creation): parallel — different files
- T009 (apple meta tags): can be added to all 8 HTML files in parallel

---

## Parallel Example: Phase 1

```bash
# These two tasks can run simultaneously:
Task T002: Create frontend/public/icons/icon-192.png
Task T003: Create frontend/public/icons/icon-512.png
```

---

## Implementation Strategy

### MVP First (US1 only — Android installability)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational — write failing tests (T004)
3. Complete Phase 3: US1 — configure plugin, build, pass tests (T005-T007)
4. **STOP and VALIDATE**: All build tests pass; deploy to HTTPS and test Chrome on Android
5. US2 (Desktop) is already delivered at this point

### Incremental Delivery

1. Phases 1-3 → Android + Desktop installability delivered ✅
2. Phase 5 → iOS home screen support added ✅
3. Phase 6 → Polish and regression check ✅

---

## Notes

- `[P]` tasks touch different files — safe to run in parallel
- `[Story]` label maps each task to its user story for traceability
- TDD: T004 tests MUST fail before T005 is implemented — do not skip this check
- US1 and US2 share identical implementation; Phase 4 is verification-only
- Commit after Phase 3 (MVP done), again after Phase 5 (iOS done), again after Phase 6
- The install prompt will NOT appear reliably on `localhost` — test against the HTTPS production URL
