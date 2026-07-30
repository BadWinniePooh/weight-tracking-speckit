# Tasks: Repository Restructure and Self-Hosting Documentation

**Input**: Design documents from `/specs/004-repo-restructure-docs/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅
**Regenerated**: 2026-03-14 — incorporates FR-008–FR-012 (secrets management) and FR-022 added by `/speckit.clarify` after initial task generation.

**Tests**: One TDD task (T016) is required by Constitution Principle III — FR-012 introduces new backend logic (constructing the PostgreSQL connection string from individual env vars). All other existing test suites must pass unchanged after the restructure.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app layout: `frontend/` and `backend/` at repository root. All backend changes are in `backend/WeightTracker.Api/` or `backend/WeightTracker.Infrastructure/`; backend tests are in `backend/WeightTracker.Tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `frontend/` directory so subsequent `git mv` commands have a destination.

- [X] T001 Create `frontend/` directory at repository root (`mkdir frontend`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Move all frontend files, establish secrets management infrastructure, and update the backend to read individual credential env vars. All of this MUST complete before any user story can be verified.

**⚠️ CRITICAL**: No user story work can begin until this entire phase is complete and committed.

### Part A — File Moves

- [X] T002 Move `src/` into frontend using `git mv src frontend/src`
- [X] T003 [P] Move `tests/` into frontend using `git mv tests frontend/tests`
- [X] T004 [P] Move `public/` into frontend using `git mv public frontend/public`
- [X] T005 [P] Move `package.json` into frontend using `git mv package.json frontend/package.json`
- [X] T006 [P] Move `package-lock.json` into frontend using `git mv package-lock.json frontend/package-lock.json`
- [X] T007 [P] Move `tsconfig.json` into frontend using `git mv tsconfig.json frontend/tsconfig.json`
- [X] T008 [P] Move `vite.config.ts` into frontend using `git mv vite.config.ts frontend/vite.config.ts`
- [X] T009 [P] Move `vitest.config.ts` into frontend using `git mv vitest.config.ts frontend/vitest.config.ts`
- [X] T010 [P] Move `nginx.conf` into frontend using `git mv nginx.conf frontend/nginx.conf`
- [X] T011 [P] Move `Dockerfile` into frontend using `git mv Dockerfile frontend/Dockerfile`
- [X] T012 [P] Move `entrypoint.sh` into frontend using `git mv entrypoint.sh frontend/entrypoint.sh`

### Part B — Secrets and Configuration Management

- [X] T013 Verify `.env` is listed in `.gitignore` at the repository root; add the line `.env` if it is not already present in `.gitignore`

- [X] T014 Create `.env.example` at the repository root containing all 7 configurable variables, each with a placeholder value and a one-line comment. Exact content:
  ```
  # Hostname of the PostgreSQL service (use 'db' for Docker Compose internal networking)
  DB_HOST=db
  # Port PostgreSQL listens on
  DB_PORT=5432
  # Name of the PostgreSQL database
  DB_NAME=weighttracker
  # PostgreSQL username
  DB_USER=weighttracker
  # PostgreSQL password — CHANGE THIS before deploying to any internet-accessible host
  DB_PASSWORD=change_me
  # URL of the backend API as seen by the browser (e.g. http://your-server-ip:8080)
  API_URL=http://localhost:8080
  # CORS allowed origin — must match the URL users use to access the frontend
  ALLOWED_ORIGIN=http://localhost:3000
  ```

- [X] T015 Rewrite `docker-compose.yml` to: (a) change the frontend build context from `context: .` to `context: ./frontend`, and (b) replace every hardcoded credential and configuration value across all three services (`db`, `backend`, `frontend`) with `${VAR_NAME}` variable interpolation referencing the variables defined in `.env.example`. **Critically**: remove `ConnectionStrings__DefaultConnection` from the backend service env block entirely — it must not remain in any form. Replace it with the five individual `DB_*` variables. No hardcoded connection string or credential may remain anywhere in the file. Result: `POSTGRES_DB: ${DB_NAME}`, `POSTGRES_USER: ${DB_USER}`, `POSTGRES_PASSWORD: ${DB_PASSWORD}`, `DB_HOST: ${DB_HOST}`, `DB_PORT: ${DB_PORT}`, `DB_NAME: ${DB_NAME}`, `DB_USER: ${DB_USER}`, `DB_PASSWORD: ${DB_PASSWORD}`, `AllowedOrigin: ${ALLOWED_ORIGIN}`, `API_URL: ${API_URL}`

### Part C — Backend Connection String (TDD — Constitution Principle III)

- [X] T016 Write a **failing** xUnit test in `backend/WeightTracker.Tests/Unit/` that verifies the backend assembles a valid PostgreSQL connection string from the individual environment variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. The test must fail before T017 is implemented. Test file: `backend/WeightTracker.Tests/Unit/ConnectionStringBuilderTests.cs` (or equivalent unit test for the configuration startup code)

- [X] T017 Update `backend/WeightTracker.Api/Program.cs` (or the Infrastructure service registration where `DbContext` is configured) to read `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` from environment variables and construct the Npgsql connection string in the format `Host={DB_HOST};Port={DB_PORT};Database={DB_NAME};Username={DB_USER};Password={DB_PASSWORD}`. Remove the `ConnectionStrings__DefaultConnection` configuration key dependency. Additionally, update any existing integration tests in `backend/WeightTracker.Tests/` that previously injected `ConnectionStrings__DefaultConnection` via `WebApplicationFactory` config override — replace those injections with the five individual `DB_*` env vars so the existing integration tests remain green. Verify all tests pass (`cd backend && dotnet test`)

**Checkpoint**: All tracked frontend files are under `frontend/`. `.env.example` committed. `.env` gitignored. `docker-compose.yml` uses `${VAR}` interpolation throughout. Backend reads individual env vars. Run `git status` to confirm all moves show as renames. Commit this phase before proceeding.

---

## Phase 3: User Story 1 — Full Stack Builds and Runs After Restructure (Priority: P1) 🎯 MVP

**Goal**: Verify the full stack builds and runs correctly after the restructure, that the `.env`-based configuration works end-to-end, and that no tests regress.

**Independent Test**: Copy `.env.example` to `.env`. Run `docker compose up --build` — all three containers start. Run `cd frontend && npm install && npm test` — all Vitest tests pass. Run `cd backend && dotnet test` — all xUnit tests pass including T016's connection string test.

### Implementation for User Story 1

- [X] T018 [US1] Copy `.env.example` to `.env` at the repository root (for local verification) — confirm the file exists and all 7 variables are populated before proceeding
- [X] T019 [US1] Run `cd frontend && npm install` to install frontend dependencies in their new location; verify `node_modules/` is created under `frontend/`
- [X] T020 [US1] Run `cd frontend && npm test` and verify all existing Vitest tests pass without modification
- [X] T021 [US1] Run `cd backend && dotnet test` and verify all existing xUnit tests pass — including T016's connection string assembly test
- [X] T022 [US1] Run `docker compose up --build` from the repository root and verify all three services (db, backend, frontend) start healthy; confirm the app is accessible at http://localhost:3000 and that data can be entered and saved

**Checkpoint**: Full stack works end-to-end with `.env`-based configuration. User Story 1 is complete. Commit phase before proceeding.

---

## Phase 4: User Story 2 — New User Deploys the App via Quick-Start (Priority: P2)

**Goal**: Write `README.md` at the repository root so a person with no prior project knowledge can deploy a running instance in under 10 minutes by following only the README.

**Independent Test**: A person with Docker and Docker Compose installed follows only `README.md`, copies `.env.example` to `.env`, fills in credentials, runs `docker compose up -d`, and successfully reaches the app in a browser. Cross-reference: every `${VAR}` reference in `docker-compose.yml` appears in `.env.example`.

### Implementation for User Story 2

- [X] T023 [US2] Create `README.md` at the repository root — write the app description section (what the weight tracker is, who it is for) and the prerequisites section listing Docker Engine 20.10+ and Docker Compose v2.0+ as minimum requirements

- [X] T024 [US2] Add the three-step quick-start section to `README.md`:
  - Step 1: Clone the repository (`git clone …`)
  - Step 2: Copy `.env.example` to `.env` (`cp .env.example .env`) and open `.env` to set credentials — especially `DB_PASSWORD`
  - Step 3: Start the stack (`docker compose up -d`) and open http://localhost:3000

  Each step must describe its expected outcome. Do NOT include "or accept defaults" — credentials must be explicitly set.

- [X] T025 [US2] Add a "Configuration" section to `README.md` that directs users to `.env.example` as the authoritative reference for all configurable variables; explain that `.env.example` is self-documenting with one-line comments on every variable. Do NOT duplicate the variable list inline in the README — link to or reference `.env.example` only.

- [X] T026 [US2] Add a "Further Reading" section to `README.md` with a link to `docs/runbook.md` for operators who need guidance on updates, backups, restores, rollbacks, and troubleshooting

**Checkpoint**: README complete. Verify the README's quick-start references `.env.example` copy as step 1, and that the Configuration section points to `.env.example` rather than inlining a variable table. Commit phase before proceeding.

---

## Phase 5: User Story 3 — Operator Maintains a Running Instance Using the Runbook (Priority: P3)

**Goal**: Write `docs/runbook.md` covering all seven operational procedures with exact shell commands and expected output descriptions, so an operator can complete any task without external research.

**Independent Test**: An operator can follow each of the seven runbook sections independently and achieve the described outcome. Each procedure contains exact commands and describes what successful output looks like. No reference to `ConnectionStrings__DefaultConnection` or other removed/renamed variables appears anywhere.

### Implementation for User Story 3

- [X] T027 [US3] Create the `docs/` directory and create `docs/runbook.md` — write the file header, table of contents, and the "Configuration" section as the **first** operational section. The Configuration section must:
  - Instruct the operator to copy `.env.example` to `.env` (`cp .env.example .env`)
  - Instruct them to open `.env` and set all required values, especially `DB_PASSWORD`
  - Include a warning: running `docker compose up` without a `.env` file (or with empty values) will cause startup failures because Docker Compose substitutes undefined variables as empty strings

- [X] T028 [US3] Add "Deploying with Docker Compose" section to `docs/runbook.md` — include exact commands to start the stack (`docker compose up -d`), check service status (`docker compose ps`), and view logs (`docker compose logs -f <service>`); describe what healthy output looks like for each command

- [X] T029 [US3] Add "Updating to a New Version" section to `docs/runbook.md` — steps: pull latest source (`git pull`), rebuild and restart without downtime (`docker compose up --build -d`); explain that the named volume `weighttracker-data` is unaffected by image rebuilds; include a prominent warning: **never run `docker compose down -v`** as it destroys the data volume

- [X] T030 [US3] Add "Backing Up the Database" section to `docs/runbook.md` — include exact command: `docker compose exec db pg_dump -U ${DB_USER} ${DB_NAME} > backup-$(date +%Y-%m-%d).sql`; note the database service must be running; describe expected output (an SQL dump file created in the current directory)

- [X] T031 [US3] Add "Restoring from Backup" section to `docs/runbook.md` — include exact command: `docker compose exec -T db psql -U ${DB_USER} ${DB_NAME} < backup-YYYY-MM-DD.sql`; warn that the target database should be empty before restoring to avoid duplicate-key errors; describe expected output

- [X] T032 [US3] Add "Rolling Back a Failed Update" section to `docs/runbook.md` — steps: check out the previous working commit (`git checkout <previous-commit-or-tag>`), rebuild (`docker compose up --build -d`); explain that the named volume is decoupled from the image so data is preserved across rollbacks

- [X] T033 [US3] Add "Troubleshooting" section to `docs/runbook.md` covering exactly three scenarios:
  - (a) **Container won't start**: use `docker compose logs <service>` to read startup error output; check that `.env` exists and all variables are set
  - (b) **Database connection errors**: verify `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `.env` match what the `db` service is configured with; confirm the `db` service is healthy (`docker compose ps`)
  - (c) **Frontend can't reach backend**: verify `API_URL` in `.env` matches the host and port the backend is actually reachable at; verify `ALLOWED_ORIGIN` matches the URL users use to access the frontend; check backend logs for CORS errors

**Checkpoint**: Runbook complete with all seven sections. Verify: (1) "Configuration" is the first section, (2) the `.env` missing-file warning is present, (3) backup/restore commands use `${DB_USER}`/`${DB_NAME}` variable references (not hardcoded `weighttracker`), (4) troubleshooting uses `DB_HOST`, `DB_PORT`, etc. Commit phase before proceeding.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and housekeeping across all user stories.

- [X] T034 Update `CLAUDE.md` commands section to reflect the new frontend path: change the frontend test command from `npm test && npm run lint` (run from repo root) to `cd frontend && npm test && npm run lint`

- [X] T035 [P] Verify `docker-compose.yml` contains no hardcoded credential or configuration literals — scan for any remaining string values that should be `${VAR}` references; confirm SC-006 compliance

- [X] T036 [P] Cross-reference every `${VAR_NAME}` reference in `docker-compose.yml` against `.env.example` entries — confirm SC-004: every interpolated variable has a corresponding entry with a placeholder and a comment in `.env.example`

- [X] T037 Run final end-to-end validation from a clean state: `docker compose down && docker compose up --build` — confirm cold-start succeeds with all three services healthy and the app accessible at http://localhost:3000

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories; covers file moves, secrets infra, and backend code change
- **Phase 3 (US1)**: Depends on Phase 2 completion — verifies build, tests, and end-to-end stack
- **Phase 4 (US2) and Phase 5 (US3)**: Both depend on Phase 3 — can proceed in parallel once P1 is verified
- **Phase 6 (Polish)**: Depends on Phases 4 and 5 completion

### User Story Dependencies

- **User Story 1 (P1)**: Depends on foundational file moves + secrets infra + backend update (Phase 2) — no dependency on US2 or US3
- **User Story 2 (P2)**: Depends on US1 (needs a working, correctly configured deployment to document) — independent of US3
- **User Story 3 (P3)**: Depends on US1 — can run in parallel with US2

### Within Each Phase

- **Phase 2 Part A**: T002 first (creates parent path); T003–T012 in parallel (different paths)
- **Phase 2 Part B**: T013 and T014 in parallel; T015 after T014 (references var names from .env.example)
- **Phase 2 Part C**: T016 → T017 sequential (test must fail before implementation)
- **Phase 3**: T018 → T019 → T020 and T021 in parallel → T022 sequential
- **Phases 4 and 5**: Fully sequential within each phase (all tasks edit the same file)
- **Phase 6**: T035 and T036 in parallel; T034 and T037 independent

### Parallel Opportunities

- T003–T012 (Phase 2 Part A): All `git mv` operations on different paths
- T013 and T014 (Phase 2 Part B): Both create new files, no dependency between them
- T020 and T021 (Phase 3): Frontend and backend test suites run independently
- Phases 4 and 5: README and runbook can be written in parallel by two people
- T035 and T036 (Phase 6): Both are read-only verification steps

---

## Parallel Example: Phase 2 File Moves

```bash
# After T002 (src/ — creates the parent path):
git mv tests frontend/tests
git mv public frontend/public
git mv package.json frontend/package.json
git mv package-lock.json frontend/package-lock.json
git mv tsconfig.json frontend/tsconfig.json
git mv vite.config.ts frontend/vite.config.ts
git mv vitest.config.ts frontend/vitest.config.ts
git mv nginx.conf frontend/nginx.conf
git mv Dockerfile frontend/Dockerfile
git mv entrypoint.sh frontend/entrypoint.sh
```

## Parallel Example: Phase 3 Test Verification

```bash
# After T019 (npm install):
cd frontend && npm test        # T020 — Vitest frontend tests
cd backend && dotnet test      # T021 — xUnit backend tests
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: All foundational work (T002–T017) — commit
3. Complete Phase 3: User Story 1 (T018–T022) — commit
4. **STOP and VALIDATE**: Stack starts with `.env`, all tests pass
5. Deploy and confirm before writing any documentation

### Incremental Delivery

1. Phase 1 + 2: Files moved, secrets managed, backend updated → Foundation complete
2. Phase 3 (US1): Build verified → Working deployment with proper secrets ✓ (MVP!)
3. Phase 4 (US2): README written → Self-hosters can deploy ✓
4. Phase 5 (US3): Runbook written → Operators can maintain ✓
5. Phase 6: Polish → Production-ready repo ✓

---

## Requirement Coverage

| FR | Covered by |
|----|-----------|
| FR-001 | T001–T012 |
| FR-002 | T015 |
| FR-003 | T020, T021, T022 (verification) |
| FR-004 | T015, T022 |
| FR-005 | T019, T020 |
| FR-006 | T021 |
| FR-007 | T002–T012, T035 |
| FR-008 | T014 |
| FR-009 | T013 |
| FR-010 | T015 |
| FR-011 | T015, T018, T024, T027 |
| FR-012 | T016 (test), T017 (impl) |
| FR-013 | T023 |
| FR-014 | T023 |
| FR-015 | T024 |
| FR-016 | T025 |
| FR-017 | T026 |
| FR-018 | T027 |
| FR-019 | T028–T033 |
| FR-020 | T033 |
| FR-021 | T027–T033 |
| FR-022 | T027 |

---

## Notes

- All file moves MUST use `git mv` (not `mv`) to preserve git history
- `node_modules/`, `dist/`, and `test-data.json` are NOT moved — regenerated or left at root
- T016 MUST fail before T017 is implemented (Constitution Principle III)
- Never document "editing `docker-compose.yml`" as an operator configuration path — operators use `.env` only
- All runbook backup/restore commands MUST use `${DB_USER}` / `${DB_NAME}` — not hardcoded values — so they work regardless of what credentials the operator chose
- Commit cadence: after Phase 2 (foundation), after Phase 3 (build verified), after Phase 4 (README), after Phase 5 (runbook)
- Never run `docker compose down -v` — destroys the data volume
