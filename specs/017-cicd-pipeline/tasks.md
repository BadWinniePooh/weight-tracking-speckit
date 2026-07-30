# Tasks: CI/CD Pipeline

**Feature**: 017-cicd-pipeline | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Establish the frontend quality gates

Nothing in the repository had ever run a linter or a typechecker, so the gates must be
made green before CI can enforce them.

- [X] **T001** Run `npx tsc --noEmit` to capture the baseline — 12 pre-existing errors.
- [X] **T002** Add the missing `DailyAverage` interface to `frontend/src/ts/model.ts`.
- [X] **T003** Correct `ChartPoint.date` from `string` to `Date` in
      `frontend/src/ts/model.ts`, matching every producer and consumer.
- [X] **T004** Add the missing `unit` property to both `computeChartData` return sites in
      `frontend/src/ts/chart-calculations.ts`.
- [X] **T005** Convert the string-date fixtures in `frontend/tests/chart.test.ts` to
      `Date` objects.
- [X] **T006** Add the explicit `importOriginal<typeof import(...)>()` generic across the
      7 affected test files.
- [X] **T007** Type the deferred promise in `frontend/tests/reset-request.test.ts` as
      `Promise<void>`.
- [X] **T008** Confirm `tsc --noEmit` exits clean and all 388 tests still pass.

## Phase 2: Introduce ESLint

- [X] **T009** Install `eslint@^9`, `@eslint/js@^9`, `typescript-eslint@^8`,
      `globals@^15` as devDependencies, with aligned major versions.
- [X] **T010** Add `frontend/eslint.config.js` (flat config) covering `src/ts`, `tests`,
      and the config files, ignoring build and tool output directories.
- [X] **T011** Configure `no-unused-vars` to honour a leading-underscore convention so
      intentionally unused parameters need no code change.
- [X] **T012** Fix the 8 reported violations: empty `EntryResponse` interface, three
      unused `catch` bindings in `main.ts`, two unused `vi` imports, one unused `result`.
- [X] **T013** Add `lint` and `typecheck` scripts to `frontend/package.json`, making the
      `npm run lint` that `CLAUDE.md` documents actually exist.
- [X] **T014** Confirm `npm run lint` exits clean.

## Phase 3: CI workflow (US1 — the MVP)

- [X] **T015** Create `.github/workflows/ci.yml` triggered on pull requests to and pushes
      on `main`, with a concurrency group that cancels superseded runs.
- [X] **T016** Add the `backend` job: .NET 8, NuGet caching, restore/build/test — with no
      Postgres service container, since Testcontainers supplies its own.
- [X] **T017** Add the `frontend` job: Node 20 with npm caching, `npm ci`, lint,
      typecheck, **build before test**, then test.
- [X] **T018** Add the `mutation` job, restricted to pull requests, uploading the Stryker
      HTML report as an artifact with `if: always()`.

## Phase 4: Image build and publish (US2)

- [X] **T019** Add the `images` job as a two-entry matrix over the backend and frontend
      Dockerfiles, depending on the test jobs.
- [X] **T020** Compute tags with `docker/metadata-action` — a full commit SHA tag plus
      `latest` on the default branch. The action lowercases the owner for GHCR.
- [X] **T021** Gate registry login and `push` on `github.event_name == 'push'` so pull
      requests, including from forks, build without publishing.
- [X] **T022** Enable GitHub Actions layer caching, scoped per image.
- [X] **T023** Fix `frontend/Dockerfile` to copy `package-lock.json` and run `npm ci`.
- [X] **T024** Add `frontend/.dockerignore` so `COPY . .` cannot clobber the installed
      dependencies.

## Phase 5: Deployment overlay (US3)

- [X] **T025** Add `docker-compose.ghcr.yml` using `!reset null` to drop the build
      contexts, with `IMAGE_TAG` defaulting to `latest`.
- [X] **T026** Verify with `docker compose config` that the overlay resolves to the
      published images and emits no `build:` section, while the base file is unchanged.

## Phase 6: Documentation

- [X] **T027** Correct the Commands section of `CLAUDE.md`: `npm run lint` now exists,
      the build must precede the tests, and add the CI reference.
- [X] **T028** Record the pipeline in the Recent Changes section of `CLAUDE.md`.

## Deferred — requires repository settings or a merged trunk

These cannot be completed from a branch and are the maintainer's to action:

- [ ] **T029** Set the repository default branch to `main`. It is currently
      `001-weight-tracker-app`, so `{{is_default_branch}}` will not tag `latest`
      correctly until this is changed. Tracked separately from this feature.
- [ ] **T030** Mark the `backend`, `frontend`, and `images` checks as required for
      merging, once the pipeline has completed one successful run.

## Mutation Testing Baseline

A full local run completed in **8 minutes 50 seconds** with a mutation score of
**49.40%** (785 killed, 270 survived, 536 uncovered, 601 compile errors).

`stryker.config.json` sets no `thresholds`, and Stryker's default `thresholds.break` is
`null`, so the job **reports but does not gate** — the run exited 0 at 49.40%. To make a
low score fail the build, add a `thresholds.break` value to `stryker.config.json`.

The HTML report is written to `frontend/reports/mutation/mutation.html` (the schema
default for `htmlReporter.fileName`), which is the path the workflow uploads.

## Verification Status

| Gate | Runnable here | Result |
|------|---------------|--------|
| `npm run lint` | yes | clean |
| `npm run typecheck` | yes | clean |
| `npm run build` + `npm test` | yes | 388/388 pass |
| `npm run test:mutation` | yes | passes — 8m50s, score 49.40% |
| `docker compose config` (overlay) | yes | resolves correctly |
| `dotnet test` | **no** — no .NET SDK in this environment | first pipeline run |
| image builds | **no** — no Docker daemon in this environment | first pipeline run |
