# Implementation Plan: CI/CD Pipeline

**Branch**: `017-cicd-pipeline` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

## Summary

Add GitHub Actions CI that runs the backend and frontend test suites, ESLint, and
TypeScript typechecking on every pull request and trunk push; run Stryker mutation
testing on pull requests; and build both container images every run, pushing them to
GHCR only on a trunk push. Introduce the ESLint toolchain the repository has always
documented but never had, and fix the defects that turning the gates on exposed.

## Technical Context

**Language/Version**: YAML (GitHub Actions); TypeScript 5.x (ESLint config); C# 12 /
.NET 8 and Node 20 as the pinned CI toolchain versions
**Primary Dependencies**: `eslint` ^9, `@eslint/js` ^9, `typescript-eslint` ^8,
`globals` ^15 (all new, dev-only); `actions/*`, `docker/*` marketplace actions
**Storage**: N/A — no schema changes
**Testing**: Existing xUnit + Testcontainers backend suite (23 files) and Vitest
frontend suite (19 files, 388 tests); Stryker for mutation testing
**Target Platform**: GitHub-hosted `ubuntu-latest` runners
**Project Type**: Web (backend + frontend)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | PASS | `spec.md` written and reviewed before any workflow file. |
| II. Privacy & Data Ownership | PASS | No user data touched. GHCR auth uses the built-in `GITHUB_TOKEN`; no secrets added. |
| III. Test-First | PASS with note | This feature *is* test infrastructure — it adds no product logic to test-drive. The existing suites are the specification of correctness, and every code fix in this feature was validated by keeping all 388 tests green. |
| IV. Incremental Delivery | PASS | US1 (verification on pull requests) is a standalone MVP; US2 (publishing) and US3 (deploy overlay) layer on top. |
| V. Simplicity | PASS | ESLint uses the recommended preset rather than type-checked linting, since `tsc --noEmit` already covers type correctness. A compose overlay is reused instead of inventing a new deployment mechanism. |

## Key Decisions

### Testcontainers, not a service container

`WeightTracker.Tests/Integration/Fixtures/ApiFixture.cs:31` builds its own
`postgres:16-alpine` container. `ubuntu-latest` ships a working Docker daemon, so the
job needs nothing extra. Adding a `services: postgres:` block would start a second,
unused database and mislead the next reader.

### Build before test (frontend)

`tests/pwa/pwa-build.test.ts` reads generated files from `dist/`. On a clean checkout
without a prior build, **35 of 388 tests fail**. `npm run build` therefore precedes
`npm test` in both the frontend and mutation jobs. This ordering was verified locally.

### Lint and typecheck as separate gates

ESLint at the recommended preset catches dead code and unsafe patterns; `tsc --noEmit`
catches type errors. Reported as separate steps so a red build names the actual cause.

### Publishing lives in the CI workflow

The `images` job declares `needs: [backend, frontend]`, which guarantees no image is
published without passing gates. A separate workflow triggered by `workflow_run` could
not express that as reliably.

### Pull requests build but never push

`push: ${{ github.event_name == 'push' }}`, and the GHCR login step is skipped entirely
on pull requests. Fork-originated pull requests have no registry write access, so this
also prevents a spurious permissions failure.

## Defects Found and Fixed

Enabling the gates surfaced pre-existing breakage that nothing had ever run:

1. **`DailyAverage` was never exported from `model.ts`** despite being imported and used
   throughout `chart-calculations.ts`. The unresolved import silently degraded the type
   to `any`, masking further errors. Added the interface.
2. **`ChartPoint.date` was typed `string`** but every producer and consumer uses a
   `Date` (Chart.js time scale). The tests were already casting `as Date`. Corrected the
   type and the two string-date test fixtures in `chart.test.ts`.
3. **`ChartDataSet.unit` was missing** from both `computeChartData` return sites.
4. **`importOriginal()` needs an explicit generic** under Vitest 2's types — 7 test
   files affected.
5. **Eight ESLint violations**: an empty `EntryResponse` interface, three unused `catch`
   bindings, two unused `vi` imports, one unused `result`, and one intentionally unused
   `_corrupt` parameter (handled by an `^_` ignore pattern rather than a code change).
6. **`frontend/Dockerfile` ignored the lockfile** — it copied only `package.json` and ran
   `npm install`. Now copies `package-lock.json` and runs `npm ci`.
7. **No `frontend/.dockerignore`** — the root one does not apply to the `./frontend`
   build context, so `COPY . .` would overwrite the `npm ci` result with host
   `node_modules`.

None of these changed runtime behaviour; all 388 tests pass before and after.

## Project Structure

```text
.github/workflows/ci.yml        # NEW — all four jobs
docker-compose.ghcr.yml         # NEW — published-image overlay
frontend/eslint.config.js       # NEW — flat config
frontend/.dockerignore          # NEW
frontend/package.json           # lint + typecheck scripts, ESLint devDependencies
frontend/Dockerfile             # npm ci against the lockfile
frontend/src/ts/model.ts        # DailyAverage; ChartPoint.date: Date
frontend/src/ts/chart-calculations.ts  # unit on both return sites
frontend/src/ts/api-client.ts   # EntryResponse as type alias
frontend/src/ts/main.ts         # drop unused catch bindings
frontend/tests/*.test.ts        # importOriginal generics, Date fixtures, unused imports
CLAUDE.md                       # correct the documented commands
```

## Verification Limits

This environment has no .NET SDK and no Docker daemon, so the backend job and the image
builds could not be executed locally — they are verified by the first pipeline run.
Everything else (lint, typecheck, build, all 388 tests, and the compose overlay via
`docker compose config`) was run and is green.
