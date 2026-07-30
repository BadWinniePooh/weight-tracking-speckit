# Implementation Plan: Repository Restructure and Self-Hosting Documentation

**Branch**: `004-repo-restructure-docs` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-repo-restructure-docs/spec.md`

## Summary

Move all frontend files from the repository root into a `frontend/` directory (alongside the existing `backend/`), update `docker-compose.yml` to point its frontend build context to `./frontend`, and write two documentation files — a root `README.md` for quick-start self-hosting and `docs/runbook.md` for ongoing operational tasks.

Research (see `research.md`) confirmed that no internal config file path changes are needed beyond the single `docker-compose.yml` edit, because all path references within the moved files are relative and self-consistent. Two additional files beyond the spec's list — `public/` and `entrypoint.sh` — must also move since the frontend `Dockerfile` copies them from the build context.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), C# 12 / .NET 8 (backend — unchanged)
**Primary Dependencies**: Vite 5.x, Vitest 2.x, nginx:alpine, Docker Compose v2 (file moves only — no new dependencies)
**Storage**: PostgreSQL 16 via Docker named volume `weighttracker-data` (unchanged)
**Testing**: Vitest (`npm test` from `frontend/`), xUnit (`dotnet test` from `backend/`) — both must pass without modification
**Target Platform**: Docker Compose on Linux/macOS host; app served via nginx:alpine container
**Project Type**: Web application (frontend + backend + database)
**Performance Goals**: No new performance requirements; existing behaviour preserved
**Constraints**: `git mv` MUST be used for all tracked file moves to preserve git history; `node_modules/` and `dist/` are NOT moved (gitignored, regenerated)
**Scale/Scope**: Single-developer repo restructure; one YAML line change + file moves + two new Markdown files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | `spec.md` complete with acceptance scenarios and success criteria |
| II. Privacy & Data Ownership | ✅ PASS | Feature does not touch health data storage or transmission; runbook documents that default DB credentials must be changed for production |
| III. Test-First | ✅ PASS | This feature is a file-move + documentation task; no new business logic. The acceptance test is the existing test suites passing unchanged. No new testable logic requires TDD. |
| IV. Incremental Delivery | ✅ PASS | P1 (working build after restructure), P2 (README), P3 (runbook) are independently deliverable and testable |
| V. Simplicity (YAGNI) | ✅ PASS | Only one line changes in `docker-compose.yml`; no new abstractions, dependencies, or configurability |

## Project Structure

### Documentation (this feature)

```text
specs/004-repo-restructure-docs/
├── plan.md              # This file
├── research.md          # Phase 0 output — file inventory, path analysis, env var table
├── quickstart.md        # Phase 1 output — developer implementation guide
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

No `data-model.md` or `contracts/` — this feature introduces no new data entities or external interfaces.

### Source Code (repository root, after this feature)

```text
backend/                          # Unchanged
  WeightTracker.Domain/
  WeightTracker.Infrastructure/
  WeightTracker.Api/
  WeightTracker.Tests/

frontend/                         # New — all previously root-level frontend files
  src/
    ts/
    css/
  tests/
  public/
    config.json.template
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  nginx.conf
  Dockerfile
  entrypoint.sh

docs/                             # New — created by this feature
  runbook.md

docker-compose.yml                # Updated: frontend build context → ./frontend
README.md                         # New — self-hosting quick-start
```

**Structure Decision**: Web application layout (Option 2 from template). The existing `backend/` directory establishes the pattern; `frontend/` mirrors it. All other repo-level files stay at the root.

## Complexity Tracking

No constitution violations — this plan requires no complexity justification.

## Phase 0: Research Summary

See `research.md` for full detail. Key findings:

1. **No config file changes required** — all internal paths in `vite.config.ts`, `vitest.config.ts`, and `tsconfig.json` are relative and remain correct after the move.
2. **Additional files to move** — `public/` and `entrypoint.sh` must move to `frontend/` (they are copied by the Dockerfile and must be within the build context).
3. **Single docker-compose.yml change** — `context: .` → `context: ./frontend` in the frontend service.
4. **6 environment variables** to document in README — `API_URL`, `AllowedOrigin`, `ConnectionStrings__DefaultConnection`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
5. **Runbook procedures** use `docker exec` + `pg_dump`/`psql` for backup/restore; `git pull` + `docker compose up --build -d` for updates.

## Phase 1: Design Decisions

### File Move Strategy

- Use `git mv` for all version-controlled files to preserve git history.
- `node_modules/`, `dist/`, and `test-data.json` stay at root or are ignored — they are not frontend build inputs.
- `test-data.json` at the repo root is ad-hoc test data used for backend manual testing; it is not part of the frontend and stays at root.

### docker-compose.yml Edit

Single targeted edit — no other services change:

```yaml
frontend:
  build:
    context: ./frontend   # was: .
    dockerfile: Dockerfile
```

### README.md Structure

```text
# Weight Tracker

[Short description]

## Prerequisites
## Quick Start (3 steps)
## Environment Variables
## Further Reading
```

### docs/runbook.md Structure

```text
# Runbook: Weight Tracker Self-Hosting

## Initial Configuration
## Deploying with Docker Compose
## Updating to a New Version
## Backing Up the Database
## Restoring from Backup
## Rolling Back a Failed Update
## Troubleshooting
  ### Container Won't Start
  ### Database Connection Errors
  ### Frontend Can't Reach Backend
```

### No Contracts or Data Model

This feature defines no new API endpoints, CLI commands, or data schemas. The `contracts/` directory is not created.

## Implementation Phases (for /speckit.tasks)

### Phase 1 — Repository Restructure (P1 user story)

1. Create `frontend/` directory
2. `git mv` all tracked frontend files into `frontend/`
3. Edit `docker-compose.yml` — update frontend build context
4. Run `docker compose up --build` and verify all three services start
5. Run `cd frontend && npm install && npm test` — verify no regressions
6. Run `cd backend && dotnet test` — verify no regressions

### Phase 2 — Root README (P2 user story)

1. Write `README.md` at repo root with all required sections (FR-008 to FR-012)
2. Verify env var table completeness against `research.md` inventory

### Phase 3 — Runbook (P3 user story)

1. Create `docs/` directory
2. Write `docs/runbook.md` with all required sections and exact commands (FR-013 to FR-015)
3. Verify each procedure is complete with expected output descriptions
