# Feature Specification: CI/CD Pipeline

**Feature Branch**: `017-cicd-pipeline`
**Created**: 2026-07-29
**Status**: Draft
**Input**: User description: "Implement a CI/CD pipeline for the project, including publishing container images to GHCR."

## Context

Sixteen features have shipped with no automated verification of any kind — the
repository has no `.github/` directory. Every check (`dotnet test`, `vitest`) has only
ever run on a developer machine, and nothing prevents a regression from reaching the
trunk. Two latent defects found while specifying this feature illustrate the cost:
`tsc --noEmit` failed with 12 pre-existing type errors, and the frontend test suite
fails outright unless `npm run build` has been run first — neither was visible because
nothing ever ran them in a clean environment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contributor Gets Automated Verification on a Pull Request (Priority: P1)

A contributor opens a pull request. Without asking anyone, they receive an automated
verdict on whether the backend tests, frontend tests, type checking, and linting all
pass against their change, and whether both container images still build.

**Why this priority**: This is the core value. Until a PR is automatically verified,
the trunk's health depends entirely on individual discipline. This story alone makes
pull requests meaningful and is a usable MVP on its own.

**Independent Test**: Open a pull request containing a deliberate test failure and
confirm the pipeline reports a failed check; open one with a clean change and confirm
all checks pass.

**Acceptance Scenarios**:

1. **Given** a pull request that breaks a backend test, **When** the pipeline runs,
   **Then** the backend job fails and the failure is visible on the pull request.
2. **Given** a pull request that introduces a TypeScript type error, **When** the
   pipeline runs, **Then** the typecheck job fails even though the runtime tests pass.
3. **Given** a pull request that introduces a lint violation, **When** the pipeline
   runs, **Then** the lint job fails.
4. **Given** a pull request that breaks either `Dockerfile`, **When** the pipeline runs,
   **Then** the image build job fails before anything is published.
5. **Given** a clean pull request, **When** the pipeline runs, **Then** every check
   passes and the pull request is reported as mergeable.

---

### User Story 2 - Maintainer Publishes Container Images on Merge (Priority: P2)

When a change lands on the trunk, both the backend and frontend container images are
built and pushed to GitHub Container Registry, tagged so that a specific commit can be
deployed and rolled back.

**Why this priority**: Depends on US1 passing first — publishing an unverified image is
worse than publishing none. Valuable but not required for the pipeline to be useful.

**Independent Test**: Merge a commit to the trunk and confirm two packages appear in
GHCR tagged with both the commit SHA and a moving tag.

**Acceptance Scenarios**:

1. **Given** a commit is pushed to the trunk, **When** the publish workflow runs,
   **Then** `weight-tracker-backend` and `weight-tracker-frontend` images are pushed to
   GHCR.
2. **Given** an image is published, **When** a maintainer inspects its tags, **Then**
   both a commit-SHA tag and a `latest` tag are present.
3. **Given** a pull request (not a merge), **When** the pipeline runs, **Then** images
   are built for verification but **not** pushed to the registry.

---

### User Story 3 - Operator Deploys a Published Image Without Building (Priority: P3)

An operator running the self-hosted stack pulls pre-built images instead of compiling
from source on the server.

**Why this priority**: A convenience unlocked by US2. The existing build-from-source
path must keep working for local development.

**Acceptance Scenarios**:

1. **Given** published images exist, **When** an operator sets the image-tag variable
   and starts the stack, **Then** the published images are pulled rather than built.
2. **Given** no image-tag override is set, **When** a developer starts the stack
   locally, **Then** the images are still built from the local source as before.

---

### Edge Cases

- Frontend tests read from `dist/`, so the build **must** precede the test run;
  otherwise 35 tests fail on a clean checkout.
- Backend integration tests start their own PostgreSQL container via Testcontainers, so
  the runner needs a working Docker daemon — but must **not** be given a separate
  Postgres service container, which would go unused.
- Mutation testing is significantly slower than the unit suite and must not be allowed
  to mask which check actually failed.
- A fork-originated pull request has no write access to the registry; publishing must be
  restricted to trunk pushes so such a pull request cannot fail on a permissions error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST run automatically on every pull request and on every
  push to the trunk branch.
- **FR-002**: The pipeline MUST run the backend test suite with a Docker daemon
  available so Testcontainers can start PostgreSQL. It MUST NOT declare a separate
  Postgres service container.
- **FR-003**: The pipeline MUST pin the .NET SDK to version 8 and Node.js to version 20,
  matching the versions used in both Dockerfiles.
- **FR-004**: The pipeline MUST run `npm run build` before the frontend test suite,
  because the PWA build assertions read generated files from `dist/`.
- **FR-005**: The pipeline MUST fail the build on any ESLint violation.
- **FR-006**: The pipeline MUST fail the build on any TypeScript type error, reported
  separately from lint so the cause is unambiguous.
- **FR-007**: The pipeline MUST run Stryker mutation testing on every pull request and
  publish its HTML report as a downloadable artifact.
- **FR-008**: The pipeline MUST verify that both `frontend/Dockerfile` and
  `backend/WeightTracker.Api/Dockerfile` build successfully.
- **FR-009**: On pushes to the trunk only, the pipeline MUST push both images to GHCR
  tagged with the commit SHA and with `latest`.
- **FR-010**: Pull request runs MUST build images without pushing them.
- **FR-011**: Dependency installation MUST use the lockfile (`npm ci`) so CI resolves
  the exact dependency tree the lockfile records.
- **FR-012**: `docker-compose.yml` MUST allow an operator to run published images while
  keeping the existing build-from-source behaviour as the default.
- **FR-013**: The repository MUST provide a working `npm run lint` script, which
  `CLAUDE.md` already documents but which does not exist.

### Key Entities

- **CI Workflow**: Runs quality gates on pull requests and trunk pushes. Jobs: backend
  tests, frontend checks, mutation testing, and image build.
- **Image Job**: Builds both images on every run and pushes them to GHCR only on a trunk
  push. It depends on the test jobs, so an unverified image can never be published. Kept
  in the same workflow as the gates rather than a separate one, because a cross-workflow
  trigger cannot express that dependency as reliably.
- **Container Image**: Two per commit — backend and frontend — each tagged with the
  commit SHA and `latest`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A pull request introducing a failing backend test, a type error, or a lint
  violation is blocked by a visibly failed check in each case.
- **SC-002**: A clean checkout of the trunk passes every pipeline gate with no manual
  setup steps.
- **SC-003**: `npm run lint` and `npm run typecheck` both exit zero on the trunk.
- **SC-004**: Merging to the trunk results in two GHCR packages, each carrying a
  commit-SHA tag and a `latest` tag.
- **SC-005**: A pull request run publishes no image to the registry.
- **SC-006**: An operator can deploy a specific commit by setting a single image-tag
  variable, and a developer with no override still gets a build from source.

## Assumptions

- The pipeline targets GitHub Actions on GitHub-hosted `ubuntu-latest` runners, which
  provide a Docker daemon — a prerequisite for the backend's Testcontainers tests.
- GHCR is the registry, authenticated with the built-in `GITHUB_TOKEN`; no additional
  secrets need to be provisioned.
- The trunk branch is `main`. The repository's default branch is currently
  `001-weight-tracker-app` and `main` does not yet contain the project history; this is
  a known, separate concern and is explicitly out of scope for this feature. The
  workflows are written to target `main` so they become correct once that is resolved.
- Deployment to the self-hosted host is out of scope; the pipeline ends at publishing
  images.
- ESLint is introduced at its recommended (non-type-checked) preset. Type correctness is
  covered by the separate `tsc --noEmit` gate, keeping the two concerns distinct and the
  configuration simple per the constitution's YAGNI principle.
