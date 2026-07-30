# Research: Documentation Overhaul (012-docs-overhaul)

## 1. Baseline Audit

### README.md — Current State

**Accurate and preserve as-is**:
- Application description paragraph (correct and well-written)
- Prerequisites block (Docker Engine 20.10+, Docker Compose v2.0+)
- Quick-start steps 1–3 (clone → configure → `docker compose up -d`)
- The quick-start URL `http://localhost:3000` (correct for local dev)

**Must update**:
- "Configuration" section: currently directs readers to `.env.example` as the authoritative reference. With the overhaul, the full env var table moves to `docs/deployment.md`. This section should become a single sentence linking there.
- "Further Reading" section: currently links only to `docs/runbook.md`. Must also link to `docs/deployment.md` and `docs/architecture.md`.

**Must add**:
- Brief feature summary (bullet list or short paragraph: weight logging, trend chart, goal tracking, admin panel, self-hosted).
- Note in quick-start that for production / TLS setup, see `docs/deployment.md`.
- Link to first-run wizard note after the `docker compose up -d` step.

---

### docs/runbook.md — Current State

**Accurate — keep in runbook.md**:
- "Updating to a New Version" — correct and operational.
- "Rolling Back a Failed Update" — correct.
- "Troubleshooting" — mostly correct; the CORS entry references `API_URL` which is now left empty for the nginx-proxied production setup (this is accurate per `.env.example`).

**Must move to docs/deployment.md** (remove from runbook, add link):
- "Configuration" section (cp `.env.example`, env var explanation).
- "Authentication Setup" section (JWT setup, Option A env seeding, Option B first-run wizard, HTTPS/cookie requirements).
- "Deploying with Docker Compose" section (startup commands belong in deployment.md; runbook keeps only operational `docker compose ps` / logs).

**Must move to docs/backup.md** (remove from runbook, add link):
- "Backing Up the Database" section.
- "Restoring from Backup" section.

**Must add to runbook.md**:
- Health check procedure (currently missing; `docker compose ps` and `/health` endpoint).
- Prominent link to `docs/backup.md` replacing the backup/restore sections.
- Prominent link to `docs/deployment.md` replacing the configuration/setup sections.

---

### docs/design-system.md — Out of scope

Read-only reference. Not modified. Not linked from the new documentation set.

---

## 2. Content Mapping — Single Source of Truth

| Topic | Canonical File | Other files action |
|-------|---------------|-------------------|
| App description | README.md | — |
| Feature summary | README.md | — |
| Prerequisites | docs/deployment.md | README.md: 1-line mention + link |
| Quick-start (local dev) | README.md | — |
| Full env var reference table | docs/deployment.md | README.md: link; runbook: link |
| Docker Compose startup | docs/deployment.md | README.md: brief steps; runbook: link |
| Traefik + TLS setup | docs/deployment.md | — |
| First-run wizard | docs/deployment.md | README.md: 1-sentence note + link |
| JWT secret setup | docs/deployment.md | — |
| HTTPS/cookie requirements | docs/deployment.md | — |
| System architecture diagram | docs/architecture.md | — |
| Data model diagram | docs/architecture.md | — |
| Tech stack + rationale | docs/architecture.md | — |
| Backup procedures | docs/backup.md | deployment.md: link; runbook: link |
| Restore procedures | docs/backup.md | deployment.md: link; runbook: link |
| Health checks | docs/runbook.md | — |
| Version upgrades | docs/runbook.md | — |
| Rollback | docs/runbook.md | — |
| Troubleshooting | docs/runbook.md | — |

---

## 3. Architecture Diagram Content (for docs/architecture.md)

### System components (from docker-compose.yml + codebase)

```
User browser
  └── HTTPS → Traefik (reverse proxy, TLS termination, rate limiting)
        └── HTTP → nginx container (frontend + /api/ proxy)
              ├── Static files (HTML/CSS/JS)
              └── /api/* → HTTP → .NET backend (ASP.NET Core Minimal API, port 8080)
                    └── TCP → PostgreSQL 16 (Docker named volume)
```

Rate limiting: Traefik applies per-IP rate limiting on `/api/auth/login` and `/api/auth/reset-password/request`.

### Technology stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend runtime | TypeScript 5.x, Vite | Type safety; fast build |
| UI framework | Tailwind CSS v3 + DaisyUI v4 | Utility-first; component library avoids CSS sprawl |
| Charts | Chart.js 4 + date-fns | Mature time-series charting; date-fns handles locale formatting |
| Frontend server | nginx:alpine | Minimal static file server; also proxies /api/ to backend |
| Backend language | C# 12 / .NET 8 | Type-safe, performant; Minimal API reduces boilerplate |
| Backend architecture | Ports & Adapters (Domain/Infrastructure/Api) | Isolates business logic from framework and DB |
| ORM | EF Core 8 + Npgsql | First-class PostgreSQL support; migration tooling |
| Database | PostgreSQL 16 | Relational; ACID; well-supported backup tooling |
| Auth | JWT (access) + HttpOnly cookie (refresh) | Stateless access token; refresh token protected from XSS |
| Password hashing | BCrypt | Industry standard; adaptive cost |
| Email | MailKit / SMTP | Standard SMTP; configurable for any provider |
| Reverse proxy | Traefik v2.x | Docker-native service discovery; automatic TLS via Let's Encrypt |
| Containerisation | Docker Compose v2 | Single-file orchestration; appropriate for single-host self-hosting |

### Data model (key entities)

- **User**: id, username, email, password_hash, role (user/admin), is_active, email_confirmed, scheduled_deletion_at, created_at
- **WeightEntry**: id, user_id (FK), weight_value, unit (kg/lbs), timestamp, created_at
- **ChartSettings**: id, user_id (FK), preferred_unit, weight_goal, loss_rate, carb_fat_ratio, buffer_value, updated_at
- **RefreshToken**: id, user_id (FK), token_hash, created_at, expires_at, revoked_at
- **PasswordResetToken**: id, user_id (FK), token_hash, created_at, expires_at, used_at
- **EmailConfirmationToken**: id, user_id (FK), token_hash, created_at, expires_at
- **AuditLogEntry**: id, action_type, actor_user_id, target_user_id, ip_address, timestamp

---

## 4. Diagram Format Decision

**Decision**: MermaidJS for all diagrams.

**Rationale**: MermaidJS renders natively on GitHub without any additional tooling or server. PlantUML requires a server render or a GitHub plugin. Since the project is GitHub-hosted and self-hosters read docs on GitHub, MermaidJS is the strictly lower-friction choice.

**Alternatives considered**: PlantUML — rejected because GitHub does not natively render PlantUML; ASCII art — rejected per spec constraint.

---

## 5. docs/backup.md Procedure Scope

Three procedures to document:

1. **Create a backup** — `docker compose exec db pg_dump` → SQL dump file with date-stamped filename. Note: db service must be running.
2. **Verify a backup** — inspect the dump file (line count, presence of `CREATE TABLE`, absence of error lines); optionally restore to a test container.
3. **Restore from backup** — `docker compose exec -T db psql` feeding the dump file. Pre-condition: target database must be empty (truncate or drop/recreate).

Current content in `docs/runbook.md` covers procedures 1 and 3 accurately. Procedure 2 (verification) is currently missing and will be added in `docs/backup.md`.

---

## 6. docs/runbook.md Health Check Content (currently missing)

Health check procedure to add:
- `docker compose ps` — verify all three services show `(healthy)` status.
- `curl http://localhost:8080/health` (or via `docker compose exec backend`) — backend health endpoint returns 200 with DB connectivity status.
- Per-service log inspection: `docker compose logs -f <service>` for real-time output.
