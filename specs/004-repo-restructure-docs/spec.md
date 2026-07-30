# Feature Specification: Repository Restructure and Self-Hosting Documentation

**Feature Branch**: `004-repo-restructure-docs`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "Reorganize the repository structure so that all frontend files currently at the repo root are moved into a frontend/ directory, placing it at the same level as the existing backend/ directory. Files to move include: src/, package.json, package-lock.json, tsconfig.json, vite.config.ts, vitest.config.ts, nginx.conf, Dockerfile, tests/, and node_modules/. All relative paths, build scripts, Docker references, and CI configuration must be updated to reflect the new location. Additionally, create two documentation files targeted at a self-hosting audience: README.md (repo root) and docs/runbook.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full Stack Builds and Runs After Restructure (Priority: P1)

A developer clones the repository after the restructure and runs the existing build/deploy command. The full stack — frontend, backend, and database — starts correctly without any path-related errors, as if nothing had changed except the directory layout.

**Why this priority**: If the restructure breaks the build or Docker Compose stack, nothing else works. All other stories depend on this foundation.

**Independent Test**: Can be fully tested by running `docker compose up --build` from the repo root after moving files and verifying all three containers start and the app is accessible in a browser — delivering a working deployment as the sole output.

**Acceptance Scenarios**:

1. **Given** the frontend files have been moved to `frontend/`, **When** a developer runs the Docker Compose build from the repo root, **Then** all three services (database, backend, frontend) start successfully with no build errors.
2. **Given** the restructured repo, **When** a developer runs the frontend test suite from within the `frontend/` directory, **Then** all existing tests pass without modification.
3. **Given** the restructured repo, **When** a developer runs the backend test suite from within the `backend/` directory, **Then** all existing tests pass without modification.
4. **Given** the restructured repo, **When** a developer inspects the frontend build output, **Then** the compiled assets are produced in the expected location and served correctly by the frontend container.

---

### User Story 2 - New User Deploys the App via Quick-Start (Priority: P2)

A person who wants to self-host the weight tracker reads the root `README.md`, follows its three-step quick-start guide, and has a running instance of the app within minutes — without needing to read any code or understand the internal project structure. The first step of deployment is copying `.env.example` to `.env` and setting their credentials.

**Why this priority**: The root README is the first thing any visitor sees. A clear quick-start is the primary deliverable of the documentation portion of this feature and directly reduces setup friction.

**Independent Test**: Can be fully tested by a person with no prior project knowledge following only the README instructions and successfully accessing the running app in a browser — without consulting any other file.

**Acceptance Scenarios**:

1. **Given** a machine with Docker and Docker Compose installed, **When** a new user follows the three quick-start steps in `README.md` (starting with copying `.env.example` to `.env`), **Then** the app is accessible in a browser and data can be entered and saved.
2. **Given** the `README.md`, **When** a user reviews the environment variables reference section, **Then** they can identify every configurable option, its purpose, and a placeholder value for it — and they are directed to `.env.example` as the source of truth.
3. **Given** a user who finishes the quick-start, **When** they want more detailed operational guidance, **Then** `README.md` contains a visible link to `docs/runbook.md`.

---

### User Story 3 - Operator Maintains a Running Instance Using the Runbook (Priority: P3)

An operator who already has the app running consults `docs/runbook.md` to perform common operational tasks: updating to a new version, backing up data, restoring from backup, rolling back a failed update, and diagnosing common problems. The runbook's first section walks the operator through initial configuration using `.env.example`.

**Why this priority**: Runbook procedures are essential for long-term self-hosting but are not required on day one. They build on the working deployment established by the higher-priority stories.

**Independent Test**: Can be fully tested by an operator following each runbook section independently and achieving the described outcome (e.g., a backup file is created, a restore succeeds, a version update completes without data loss).

**Acceptance Scenarios**:

1. **Given** a fresh clone, **When** the operator follows the "Configuration" section of the runbook, **Then** they copy `.env.example` to `.env`, fill in their credentials, and have a correctly configured deployment before running any Docker command.
2. **Given** a running instance, **When** the operator follows the "update to a new version" procedure in the runbook, **Then** the app is updated and all previously stored data is still accessible.
3. **Given** a running instance, **When** the operator follows the "backup PostgreSQL volume" procedure, **Then** a backup artifact is created that can later be used to restore the data.
4. **Given** a backup artifact, **When** the operator follows the "restore from backup" procedure, **Then** the data is fully restored and the app functions normally.
5. **Given** a failed update, **When** the operator follows the "rollback" procedure, **Then** the previous working version is running and data is intact.
6. **Given** a container that fails to start, **When** the operator follows the relevant troubleshooting section, **Then** the runbook provides diagnostic steps that lead to identifying and resolving the cause.

---

### Edge Cases

- What happens if a path reference inside a config file is missed during the restructure, causing a silent failure at runtime rather than a build error?
- How does the restructure affect any developer who has a locally cloned copy with uncommitted changes in the moved files?
- What happens if a user's environment does not have `envsubst` available in the Docker image used for the frontend?
- How does the runbook handle partial backup failure (e.g., disk full mid-backup)?
- What if the user's Docker version does not support a particular Compose syntax used in the file?
- What happens if an operator runs `docker compose up` without first creating a `.env` file? Docker Compose will substitute empty strings for undefined variables, causing startup failures — the runbook must warn about this and instruct the operator to verify `.env` exists before starting.

## Requirements *(mandatory)*

### Functional Requirements

**Repository Restructure**

- **FR-001**: The repository MUST contain a `frontend/` directory at the same level as `backend/`, holding all files that were previously at the repository root for the frontend: `src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `nginx.conf`, `Dockerfile`, `tests/`, and `node_modules/` (if present).
- **FR-002**: The `docker-compose.yml` at the repository root MUST reference the frontend `Dockerfile` using its new path within `frontend/`.
- **FR-003**: All internal path references within moved configuration files (e.g., Vite config, Vitest config, TypeScript config, Dockerfile) MUST be updated so they resolve correctly relative to their new location in `frontend/`.
- **FR-004**: The frontend `Dockerfile` MUST produce a working image when built with its build context set to the `frontend/` directory.
- **FR-005**: The frontend test suite MUST be runnable from within the `frontend/` directory using the same npm test command as before.
- **FR-006**: The backend test suite MUST continue to run and pass without any changes caused by the restructure.
- **FR-007**: No files required for frontend operation or testing MUST be left at the repository root after the restructure (excluding repo-level files such as `.gitignore`, `docker-compose.yml`, `README.md`, etc.).

**Secrets and Configuration Management**

- **FR-008**: A `.env.example` file MUST be committed to the repository root containing every configurable variable with a placeholder value and a one-line comment explaining what each variable controls.
- **FR-009**: The `.env` file MUST be listed in `.gitignore` and MUST NOT be committed to the repository under any circumstances.
- **FR-010**: `docker-compose.yml` MUST reference all environment values via variable interpolation (e.g., `${VAR_NAME}`); no hardcoded credential or configuration values MUST appear anywhere in `docker-compose.yml`.
- **FR-011**: The operator MUST configure the application exclusively by copying `.env.example` to `.env` and setting values — never by editing `docker-compose.yml` directly.
- **FR-012**: The backend MUST construct its PostgreSQL connection string at runtime from individual credential variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`); operators MUST NOT be required to write or know the PostgreSQL connection string format.

**Root README**

- **FR-013**: A `README.md` MUST exist at the repository root describing the purpose of the application in plain language.
- **FR-014**: `README.md` MUST list prerequisites (Docker and Docker Compose with minimum supported versions noted).
- **FR-015**: `README.md` MUST include a quick-start deployment section consisting of exactly three steps — the first step being copying `.env.example` to `.env` — that result in a running instance.
- **FR-016**: `README.md` MUST direct users to `.env.example` as the authoritative reference for configurable variables, rather than duplicating the full variable list inline.
- **FR-017**: `README.md` MUST include a link to `docs/runbook.md` for further operational guidance.

**Runbook**

- **FR-018**: A `docs/runbook.md` MUST exist; its first section MUST be "Configuration", which instructs the operator to copy `.env.example` to `.env` and fill in credentials before running any Docker command.
- **FR-019**: `docs/runbook.md` MUST cover the following operational topics (in addition to Configuration): deploying with Docker Compose, updating to a new version without data loss, backing up the PostgreSQL data volume, restoring from a backup, rolling back a failed update, and troubleshooting common issues.
- **FR-020**: The troubleshooting section of `docs/runbook.md` MUST address at least three scenarios: a container failing to start, database connection errors, and the frontend being unable to reach the backend.
- **FR-021**: Each runbook procedure MUST include the exact commands an operator needs to run, with brief explanations of what each command does and what successful output looks like.
- **FR-022**: The runbook's "Configuration" section MUST warn the operator that running `docker compose up` without a `.env` file will result in startup failures due to undefined variables substituting as empty strings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The full stack builds and all services start successfully after the restructure, with zero path-related build or runtime errors detected when running the standard Docker Compose command from the repo root.
- **SC-002**: All existing frontend and backend automated tests continue to pass at the same rate as before the restructure (no regressions introduced).
- **SC-003**: A person with no prior knowledge of the project can deploy a running instance by following only the `README.md` quick-start, completing the process in under 10 minutes on a machine with Docker and Docker Compose already installed.
- **SC-004**: Every configurable variable is documented in `.env.example` with a placeholder value and a comment — verified by cross-referencing every `${VAR}` reference in `docker-compose.yml` against the `.env.example` entries.
- **SC-005**: An operator can perform each of the seven runbook procedures (configure, deploy, update, backup, restore, rollback, troubleshoot) by following only the runbook commands, with no step requiring external research or guesswork.
- **SC-006**: No credential or sensitive configuration value appears as a hardcoded literal anywhere in `docker-compose.yml` — verified by inspection.

## Assumptions

- `node_modules/` is excluded from version control (listed in `.gitignore`) and does not need to be physically moved; it will be recreated by `npm install` in the new location.
- No CI/CD pipeline configuration files (e.g., GitHub Actions workflows) exist in this repository at this time; if they are added in the future, they will need to be updated to reflect the new `frontend/` path and to load the `.env` file or equivalent secrets.
- The Docker Compose `build.context` for the frontend service is currently set to `.` (repo root); it will be changed to `./frontend`.
- The `docs/` directory does not currently exist and will be created as part of this feature.
- The runbook targets operators comfortable running shell commands; no GUI-based tooling is assumed.
- The backend application will be updated to read `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` as individual environment variables and assemble the PostgreSQL connection string internally — removing the operator-visible `ConnectionStrings__DefaultConnection` variable.
- The `AllowedOrigin` backend configuration value and the `API_URL` frontend value will both be moved to `.env` and referenced in `docker-compose.yml` via variable interpolation.

## Clarifications

### Session 2026-03-14

- Q: Should sensitive values (DB credentials, allowed origin) be externalized to a `.env` file? → A: Yes — `.env` at repo root, gitignored; `.env.example` with placeholders committed.
- Q: How should the PostgreSQL connection string be handled for operators? → A: Backend constructs it at runtime from individual variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`); operators never write a connection string.
- Q: Should `docker-compose.yml` contain any hardcoded values? → A: No — all env values must reference `.env` variables via `${VAR_NAME}` interpolation.
- Q: Should the runbook include a configuration step before deployment? → A: Yes — "Configuration" must be the first runbook section, instructing operators to copy `.env.example` to `.env`.
- Q: How should `.env.example` document its variables? → A: Every variable must have a one-line comment explaining what it does.
