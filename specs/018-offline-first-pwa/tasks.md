# Tasks: Offline-First PWA, Foldable History, Week-Long Sessions

**Feature**: 018-offline-first-pwa | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

TDD throughout: each phase writes its failing tests first. One commit per phase.

## Phase 1: History collapse (US4 — independent MVP slice)

- [ ] **T001** Failing test `frontend/tests/history-collapse.test.ts`: parse
      `src/index.html`, assert `.collapse` wrapper inside `section.history`,
      `input#history-toggle[type=checkbox]` without `checked`, `#history-heading`
      inside `.collapse-title`, `#entry-list` inside `.collapse-content`.
- [ ] **T002** Edit `frontend/src/index.html` per plan D7. All existing tests stay
      green (FR-018, FR-019).

## Phase 2: Backend fixes (FR-016, FR-017)

- [ ] **T003** Failing integration tests in
      `Tests/Integration/Endpoints/EntryEndpointsTests` (or a new class):
      fresh POST → 201; replay of own id → 200 + original entry; POST with an id owned
      by another user → 409 and response contains no entry data.
- [ ] **T004** Failing integration tests for refresh grace: refresh with a token
      revoked <60 s ago → 200 + new pair; revoked >60 s ago → 401.
- [ ] **T005** Implement `AddOutcome` enum + tuple return in
      `IWeightEntryRepository` / `WeightEntryRepository`; map statuses in
      `EntryEndpoints.cs`; update `MigrationEndpoints` if signature ripples.
- [ ] **T006** Implement grace clause in `RefreshTokenRepository.GetActiveByHashAsync`.
- [ ] **T007** Add `WeightTracker.Domain/AuthConstants.cs`; replace the duplicated
      `RefreshTokenDays`/`expiresIn`/`AccessTokenMinutes` literals.
- [ ] **T008** `cd backend && dotnet test` green.

## Phase 3: Offline store + auth marker + config fallback (FR-001, FR-011..FR-014, FR-021)

- [ ] **T009** Failing tests `frontend/tests/offline-store.test.ts`: marker round-trip
      + `isMarkerValid` expiry logic; per-user cache isolation; queue FIFO append;
      corrupt-JSON tolerance; `wt_offline::` prefix (asserted ≠ legacy keys).
- [ ] **T010** Implement `frontend/src/ts/offline-store.ts`.
- [ ] **T011** Failing tests: auth-guard offline paths (network-throw + valid marker →
      authenticated offline; expired marker → unauthenticated; refresh 401 clears
      marker); api-client `attemptRefresh` writes/clears marker; login success writes
      marker.
- [ ] **T012** Wire marker into `auth-guard.ts` (split refresh catch; `AuthState.offline?`),
      `api-client.ts`, `login.ts`, `main.ts` logout; `config.ts` cached fallback.

## Phase 4: Entry store + sync engine (FR-002..FR-010)

- [ ] **T013** Failing tests `frontend/tests/entry-store.test.ts`: online success
      updates cache; TypeError falls back to cache+overlay; addEntry generates UUID and
      queues on failure; removeEntry cancels pending create; removeAllEntries offline
      tombstones only cached ids; loadSettings fallback chain.
- [ ] **T014** Implement `frontend/src/ts/entry-store.ts`.
- [ ] **T015** Failing tests `frontend/tests/sync.test.ts`: FIFO order; stop-on-network-
      error preserves queue; 404-delete and 4xx-create dropped; single-flight; cache
      refresh + callback after drain; `initSync` binds `online` event.
- [ ] **T016** Implement `frontend/src/ts/sync.ts`.

## Phase 5: main.ts integration + client chart (FR-003, FR-006, FR-007)

- [ ] **T017** Failing tests in `frontend/tests/main.test.ts`: offline bootstrap
      renders cached entries without settings fetch; chart driven by
      `computeChartData`; export uses in-memory entries.
- [ ] **T018** Rewire `main.ts`: `_settings` state; `refreshChart` →
      `computeChartData`; handlers → entry-store; offline bootstrap path; `initSync`
      registration + initial sync; export from memory.

## Phase 6: Service worker (FR-020..FR-022)

- [ ] **T019** Failing assertions in `frontend/tests/pwa/pwa-build.test.ts`: precache
      manifest in `dist/sw.js` includes `index.html` and `login.html`; a config.json
      NetworkFirst runtime route exists; no `/api/` caching route.
- [ ] **T020** Update `frontend/vite.config.ts` workbox config per plan D4.

## Phase 7: Verification + docs

- [ ] **T021** Full frontend gates: lint, typecheck, build, test, mutation (≥ 49.4%).
- [ ] **T022** `cd backend && dotnet test` (in CI if no local daemon).
- [ ] **T023** ARCHITECTURE.md: offline data-flow section (store, queue, sync,
      marker). CLAUDE.md recent-changes entry.
- [ ] **T024** Manual offline pass per spec SC-001..SC-003 (documented steps).
