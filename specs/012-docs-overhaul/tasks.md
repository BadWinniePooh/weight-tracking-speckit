# Tasks: Documentation Overhaul

**Input**: Design documents from `/specs/012-docs-overhaul/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓

**Organization**: Tasks are grouped by user story. Each user story produces independently verifiable documentation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

---

## Phase 1: Setup (Foundational)

**Purpose**: Create the one file that other files must link to before they can be written accurately.

**Context from research.md**: `docs/runbook.md` currently contains backup/restore procedures that belong in `docs/backup.md`. Creating `docs/backup.md` first lets `docs/deployment.md` and the updated `docs/runbook.md` link to it with a known relative path.

- [x] T001 Create docs/backup.md as a standalone document with three numbered procedures: (1) **Create a backup** — `docker compose exec db pg_dump -U $DB_USER $DB_NAME > backup-$(date +%Y-%m-%d).sql`; (2) **Verify a backup** — inspect dump for `CREATE TABLE` presence, check for error lines, optionally restore to a throwaway container; (3) **Restore from backup** — precondition: database must be empty; command: `docker compose exec -T db psql -U $DB_USER $DB_NAME < backup-YYYY-MM-DD.sql`. File must be self-contained (FR-008, FR-009). No application code modified.

**Checkpoint**: `docs/backup.md` exists and covers all three procedures. Other docs can now link to it.

---

## Phase 2: User Story 1 — Self-hoster Deploys from Scratch (Priority: P1) 🎯 MVP

**Goal**: A person with no prior knowledge can read README.md and docs/deployment.md and reach a running application without consulting any other file.

**Independent Test** (SC-001): Open README.md on GitHub, follow the quick-start and links through docs/deployment.md, and confirm a local deployment completes. Verify no information needed for deployment is missing from these two files.

### Implementation for User Story 1

- [x] T002 [US1] Create docs/deployment.md with sections in this order: (1) **Prerequisites** — Docker Engine 20.10+, Docker Compose v2.0+, a domain name with DNS pointed at the host, Traefik already running with a `traefik` external network; (2) **Environment Variables** — full reference table with columns: Variable | Description | Required | Default | Example — cover all variables from `.env.example` including DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, ALLOWED_ORIGIN, APP_DOMAIN, APP_BASE_URL, TRAEFIK_NETWORK, TRAEFIK_CERT_RESOLVER, AUTH_RATE_LIMIT_AVERAGE, AUTH_RATE_LIMIT_PERIOD, AUTH_RATE_LIMIT_BURST, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SENDER_EMAIL, USER_DELETION_GRACE_DAYS, ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD; (3) **Docker Compose Startup** — `cp .env.example .env`, edit .env, `docker compose up -d`, `docker compose ps` to verify; (4) **Traefik TLS Configuration** — explain that Traefik acts as the reverse proxy with HTTPS termination; describe the two Traefik routers defined in docker-compose.yml labels (catch-all router on `APP_DOMAIN` and the auth rate-limit router for `/api/auth/login` and `/api/auth/reset-password/request`); note the external `traefik` network requirement and Let's Encrypt cert resolver; (5) **First-Run Wizard** — explain that on first startup (no admin account exists), the app shows a setup wizard at the root URL; wizard creates the initial admin account; alternatively seed via ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD env vars; HTTPS is required for cookies (HttpOnly SameSite=Strict); (6) **Backup & Restore** — one sentence linking to [docs/backup.md](backup.md). No inline backup procedures (FR-005).

- [x] T003 [US1] Rewrite README.md with: (1) **Header** — project name + one-sentence tagline; (2) **Description** — no more than three short paragraphs: what the app is, who it is for, that it is self-hosted (FR-001); (3) **Features** — bullet list: weight logging, trend chart, calorie/macro targets, goal tracking, admin panel, CSV data import, self-hosted / your data; (4) **Quick Start** — exactly 5 numbered steps: clone repo, copy and edit .env, run `docker compose up -d`, open `http://localhost:3000`, complete the first-run setup wizard — with a note that for production TLS setup see [docs/deployment.md](docs/deployment.md) (FR-002); (5) **Further Reading** — clearly labeled links to docs/deployment.md (full deployment guide), docs/architecture.md (system architecture), docs/runbook.md (operational procedures) (FR-003). Remove the old Configuration section and replace with a single sentence linking to docs/deployment.md. Preserve the existing prerequisite mentions only as a brief in-line note in the quick-start (full prerequisites table lives in docs/deployment.md).

**Checkpoint**: User Story 1 complete. A visitor can read README.md → docs/deployment.md → docs/backup.md and complete a full production deployment.

---

## Phase 3: User Story 2 — Developer Understands Architecture (Priority: P2)

**Goal**: A developer unfamiliar with the codebase can open docs/architecture.md and correctly describe component boundaries, request flow, and key data entities without reading any source code.

**Independent Test** (SC-004): Read docs/architecture.md in isolation and verify: all major components are shown in a rendered MermaidJS diagram, all key data entities are shown in a rendered MermaidJS diagram, and every major technology in the stack has a brief rationale.

### Implementation for User Story 2

- [x] T004 [P] [US2] Create docs/architecture.md with three sections: (1) **System Overview** — MermaidJS `graph TD` diagram showing: User browser → HTTPS → Traefik (rate limiting, TLS termination) → HTTP → nginx container (static files + /api/ proxy) → HTTP → .NET backend (ASP.NET Core Minimal API, port 8080) → TCP → PostgreSQL 16 (Docker named volume `weighttracker-data`); add a prose paragraph describing the rate limiting on `/api/auth/login` and `/api/auth/reset-password/request` (5 req/min average, burst 10); (2) **Technology Stack** — table with columns: Layer | Technology | Rationale — use the exact content from research.md section 3 (Frontend runtime: TypeScript 5.x + Vite; UI framework: Tailwind CSS v3 + DaisyUI v4; Charts: Chart.js 4 + date-fns; Frontend server: nginx:alpine; Backend language: C# 12 / .NET 8; Backend architecture: Ports & Adapters; ORM: EF Core 8 + Npgsql; Database: PostgreSQL 16; Auth: JWT + HttpOnly cookie; Password hashing: BCrypt; Email: MailKit/SMTP; Reverse proxy: Traefik v2.x; Containerisation: Docker Compose v2); (3) **Data Model** — MermaidJS `erDiagram` showing entities: User (id, username, email, password_hash, role, is_active, email_confirmed, scheduled_deletion_at, created_at), WeightEntry (id, user_id FK, weight_value, unit, timestamp, created_at), ChartSettings (id, user_id FK, preferred_unit, weight_goal, loss_rate, carb_fat_ratio, buffer_value, updated_at), RefreshToken (id, user_id FK, token_hash, created_at, expires_at, revoked_at), PasswordResetToken (id, user_id FK, token_hash, created_at, expires_at, used_at), EmailConfirmationToken (id, user_id FK, token_hash, created_at, expires_at), AuditLogEntry (id, action_type, actor_user_id, target_user_id, ip_address, timestamp) — with FK relationships shown. No ASCII art anywhere in the file (FR-006, FR-007, SC-003).

**Checkpoint**: User Story 2 complete. docs/architecture.md renders two MermaidJS diagrams and a complete tech stack table.

---

## Phase 4: User Story 3 — Operator Maintains a Running Instance (Priority: P3)

**Goal**: An operator under pressure can open docs/runbook.md and complete a health check, version upgrade, or rollback without wading through setup or backup instructions.

**Independent Test** (SC-005): Search docs/runbook.md for "backup", "restore", "configuration", "environment variable", "JWT" — each of these must produce only a link, never inline instructions. Verify health check, upgrade, and rollback procedures are all present.

### Implementation for User Story 3

- [x] T005 [US3] Update docs/runbook.md: **Remove** the "Configuration" section entirely (replace with one sentence: "For environment variable reference and initial configuration, see [Deployment Guide](deployment.md)."); **Remove** the "Authentication Setup" section entirely (replace with the same deployment.md link); **Remove** the "Deploying with Docker Compose" section (keep only operational commands like `docker compose ps` and `docker compose logs`, not initial startup); **Remove** the "Backing Up the Database" section and "Restoring from Backup" section — replace both with a clearly visible callout: "For backup and restore procedures, see [Backup & Restore](backup.md)."; **Keep intact**: "Updating to a New Version", "Rolling Back a Failed Update", "Troubleshooting" (update the CORS entry to note that `API_URL` is left empty in the nginx-proxied production setup — this is correct per current .env.example); **Add** a new "Health Checks" section before "Updating to a New Version" with: `docker compose ps` (verify all three services show `(healthy)` status), `docker compose exec backend wget -qO- http://localhost:8080/health` (backend health endpoint returns 200 with DB connectivity status), and `docker compose logs -f <service>` for per-service log inspection (FR-010, FR-011, FR-012, SC-005).

**Checkpoint**: User Story 3 complete. docs/runbook.md contains no backup/restore content and no deployment/setup content; only operational procedures remain.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Link verification and final consistency review across all five files.

- [x] T006 [P] Verify all relative hyperlinks between the five documentation files resolve correctly: from README.md → docs/deployment.md, docs/architecture.md, docs/runbook.md; from docs/deployment.md → docs/backup.md; from docs/runbook.md → docs/backup.md, docs/deployment.md. Confirm each link uses a relative path (e.g., `docs/deployment.md` from README; `backup.md` from within the docs/ directory) that resolves on GitHub (SC-006).

- [x] T007 [P] Manual review against all six success criteria: SC-001 (self-hoster can deploy with only README + deployment.md), SC-002 (zero duplicated content across the five files), SC-003 (all diagrams are MermaidJS — zero ASCII art), SC-004 (architecture.md alone explains components and data model), SC-005 (runbook.md has no backup/restore content — only a link), SC-006 (all cross-references use working relative links). Verify docs/design-system.md was not modified (FR-013, FR-014).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 (T001 must exist before T002 links to it); T002 and T003 can run in parallel after T001
- **Phase 3 (US2)**: Independent — can run in parallel with Phase 2 after T001
- **Phase 4 (US3)**: Depends on Phase 1 (links to backup.md) and Phase 2 (links to deployment.md); should run after T001 and T002 are complete so links are valid
- **Phase 5 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Requires T001 (backup.md) before T002 (deployment.md links to it); T003 (README) can run in parallel with T002
- **US2 (P2)**: Independent of US1 — can start after Phase 1
- **US3 (P3)**: Requires T001 (backup.md link target) and T002 (deployment.md link target) to be complete before the content references will resolve

### Parallel Opportunities

- T002 and T004 can run in parallel (different files, no cross-dependency)
- T003 can run in parallel with T002 (README and deployment.md are different files; README links to deployment.md but can be written knowing the target path)
- T006 and T007 can run in parallel (both are read-only review tasks)

---

## Parallel Example: User Story 1 + User Story 2

```
After T001 (backup.md) is complete:
  → Task: T002 Create docs/deployment.md
  → Task: T003 Rewrite README.md
  → Task: T004 Create docs/architecture.md  (independent, can run simultaneously)
After T001 + T002 complete:
  → Task: T005 Update docs/runbook.md
After all T001–T005 complete:
  → Task: T006 Verify relative hyperlinks
  → Task: T007 Manual SC review
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001: Create docs/backup.md
2. T002: Create docs/deployment.md
3. T003: Rewrite README.md
4. **STOP and VALIDATE**: A self-hoster can deploy using only these three files
5. Proceed to US2 and US3

### Incremental Delivery

1. T001 → T002 → T003: Self-hoster path complete (MVP)
2. T004: Developer architecture path complete
3. T005: Operator runbook complete
4. T006 + T007: Full link and content verification

---

## Notes

- All five documentation files in scope: README.md, docs/deployment.md, docs/architecture.md, docs/backup.md, docs/runbook.md
- docs/design-system.md is explicitly out of scope — do not open or modify it
- No application source code files are created or modified
- MermaidJS diagrams render natively on GitHub — no additional tooling required
- Each cross-reference uses a relative path (not an absolute URL)
- Commit after each phase completes per constitution commit cadence rules
