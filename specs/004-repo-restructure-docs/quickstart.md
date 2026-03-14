# Developer Quickstart: Feature 004 — Repo Restructure and Self-Hosting Docs

**Audience**: Developer implementing this feature
**Branch**: `004-repo-restructure-docs`

---

## Prerequisites

- Git, Node.js 20+, Docker, Docker Compose v2
- Repository cloned and on branch `004-repo-restructure-docs`

---

## Implementation Steps (in order)

### Step 1 — Move Frontend Files

From the repo root, create `frontend/` and use `git mv` to move all tracked files:

```sh
mkdir frontend
git mv src frontend/src
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

Untracked / gitignored items (`node_modules/`, `dist/`) are not moved — they will be regenerated.

### Step 2 — Update docker-compose.yml

Change the frontend service build context from `.` to `./frontend`:

```yaml
frontend:
  build:
    context: ./frontend    # was: .
    dockerfile: Dockerfile
```

### Step 3 — Verify the Build

```sh
docker compose up --build
```

All three containers (db, backend, frontend) must start and the app must be reachable at http://localhost:3000.

### Step 4 — Verify Frontend Tests

```sh
cd frontend
npm install
npm test
```

All tests must pass.

### Step 5 — Write README.md

Create `README.md` at the repository root. Required sections (per FR-008 to FR-012):
- What the app is
- Prerequisites (Docker Engine 20.10+, Docker Compose v2.0+)
- Three-step quick-start
- Environment variables reference table (6 variables — see `research.md`)
- Link to `docs/runbook.md`

### Step 6 — Write docs/runbook.md

Create `docs/runbook.md`. Required sections (per FR-013 to FR-015):
- Initial configuration
- Deploying with Docker Compose
- Updating to a new version without data loss
- Backing up the PostgreSQL volume
- Restoring from backup
- Rolling back a failed update
- Troubleshooting: container won't start, DB connection errors, frontend can't reach backend

---

## Verification Checklist

- [ ] `git mv` used for all tracked files (preserves history)
- [ ] `node_modules/` and `dist/` NOT moved (regenerated)
- [ ] `docker compose up --build` succeeds with no errors
- [ ] `cd frontend && npm test` — all tests pass
- [ ] `cd backend && dotnet test` — all tests pass (should be unchanged)
- [ ] `README.md` at repo root with all required sections
- [ ] `docs/runbook.md` with all required sections and exact commands
- [ ] Env var table in README matches all 6 variables from `research.md`
