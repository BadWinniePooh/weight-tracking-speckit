# Implementation Plan: Production Hardening for Self-Hosted Deployment

**Branch**: `010-production-hardening` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-production-hardening/spec.md`

## Summary

Close the exposed backend port (`8080`) and frontend port (`3000`) that are currently published to the host. Add Traefik Docker labels to the frontend service so it is routed via an existing external Traefik instance with TLS termination. Add a nginx `proxy_pass` for `/api/` so the browser continues to reach the backend through the same origin. Rate-limit the two auth endpoints (`/api/auth/login`, `/api/auth/reset-password/request`) via a Traefik middleware (5 req/min average, burst 10). Expand `.env.example` to document all environment variables including six new Traefik/rate-limit variables and seven previously undocumented variables.

Three files change: `docker-compose.yml`, `frontend/nginx.conf`, `.env.example`. No application source code changes.

## Technical Context

**Language/Version**: YAML (Docker Compose v2), nginx config syntax, shell (env var substitution)
**Primary Dependencies**: Docker Compose v2, Traefik v2.x (labels compatible with v3.x), nginx:alpine (existing)
**Storage**: N/A — no database schema changes
**Testing**: Manual verification of port closure, HTTPS routing, and rate limiting (no automated test suite for compose/infrastructure config)
**Target Platform**: Linux server with Docker, behind an existing Traefik instance
**Project Type**: Infrastructure configuration (deployment hardening — no source code changes beyond nginx.conf)
**Performance Goals**: No performance regression; rate limit threshold (5/min) must not affect normal interactive use
**Constraints**: No frontend or backend application source code changes beyond nginx.conf; no new Docker services; no new Docker images
**Scale/Scope**: 3 files modified; 6 new env vars; 7 env vars newly documented

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | spec.md exists and is complete with user stories and success criteria |
| II. Privacy & Data Ownership | ✅ PASS | This feature strengthens privacy: closes exposed ports, enforces HTTPS, rate-limits auth. No new data transmitted to third parties. |
| III. Test-First (NON-NEGOTIABLE) | ✅ PASS (adapted) | Infrastructure config has no unit-testable logic. Acceptance is verified by manual integration tests (port closure, HTTPS routing, rate limiting) documented in quickstart.md and tasks.md. No application logic is introduced. |
| IV. Incremental Delivery (MVP First) | ✅ PASS | P1 (port closure) is independently deployable and delivers security value immediately. P2 (Traefik routing) layers on top. P3 (rate limiting) and P4 (.env.example) are additive. |
| V. Simplicity (YAGNI) | ✅ PASS | Minimal changes: 3 files modified. No new services, no new images. Rate limit values configurable but not over-engineered. |

**Post-Phase 1 re-check**: All principles hold after design. The nginx proxy_pass addition is the only code-adjacent change and is strictly required by the architecture decision to keep backend off the external network.

## Project Structure

### Documentation (this feature)

```text
specs/010-production-hardening/
├── plan.md                          # This file
├── research.md                      # Phase 0 output — all decisions documented
├── quickstart.md                    # Phase 1 output — operator deployment guide
├── contracts/
│   └── compose-interface.md         # Phase 1 output — env vars, network topology, Traefik labels
└── tasks.md                         # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
docker-compose.yml                   # MODIFIED: remove host ports; add Traefik labels + external network on frontend
frontend/nginx.conf                  # MODIFIED: add location /api/ proxy_pass to backend
.env.example                         # MODIFIED: document all env vars + 6 new Traefik/rate-limit vars
```

**Structure Decision**: Infrastructure-only change. No new source files. The existing web-application layout (`backend/`, `frontend/`) is untouched. Only deployment configuration files at the repository root and `frontend/nginx.conf` are modified.

## Implementation Design

### docker-compose.yml Changes

**Backend service**: Remove `ports: - "8080:8080"`. No other changes.

**Frontend service**:
- Remove `ports: - "3000:80"`.
- Add `networks: [default, traefik]` so it joins both the default Compose network (to reach backend) and the external Traefik network (to be discovered by Traefik).
- Add Docker labels (see below).

**Networks section** (append to file):
```yaml
networks:
  traefik:
    external: true
    name: ${TRAEFIK_NETWORK:-traefik}
```

**Traefik labels on frontend**:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=${TRAEFIK_NETWORK:-traefik}"
  - "traefik.http.services.weight-tracker.loadbalancer.server.port=80"
  # Catch-all router (no rate limit)
  - "traefik.http.routers.weight-tracker.rule=Host(`${APP_DOMAIN}`)"
  - "traefik.http.routers.weight-tracker.entrypoints=websecure"
  - "traefik.http.routers.weight-tracker.tls=true"
  - "traefik.http.routers.weight-tracker.tls.certresolver=${TRAEFIK_CERT_RESOLVER:-letsencrypt}"
  # Auth-specific router (rate limited, higher priority)
  - "traefik.http.routers.weight-tracker-auth.rule=Host(`${APP_DOMAIN}`) && (Path(`/api/auth/login`) || Path(`/api/auth/reset-password/request`))"
  - "traefik.http.routers.weight-tracker-auth.priority=10"
  - "traefik.http.routers.weight-tracker-auth.entrypoints=websecure"
  - "traefik.http.routers.weight-tracker-auth.tls=true"
  - "traefik.http.routers.weight-tracker-auth.tls.certresolver=${TRAEFIK_CERT_RESOLVER:-letsencrypt}"
  - "traefik.http.routers.weight-tracker-auth.service=weight-tracker"
  - "traefik.http.routers.weight-tracker-auth.middlewares=weight-tracker-auth-ratelimit"
  # Rate limit middleware
  - "traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.average=${AUTH_RATE_LIMIT_AVERAGE:-5}"
  - "traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.period=${AUTH_RATE_LIMIT_PERIOD:-1m}"
  - "traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.burst=${AUTH_RATE_LIMIT_BURST:-10}"
```

### frontend/nginx.conf Change

Add a `location /api/` block before the catch-all `location /` block:

```nginx
location /api/ {
    proxy_pass http://backend:8080/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

This routes browser API calls (`/api/...`) through nginx to the backend internally, enabling the backend port to be closed to the host.

### frontend/public/config.json.template and entrypoint.sh Change

**Constraint discovered during task generation**: `config.json.template` previously contained `{ "apiUrl": "${API_URL}" }` where `API_URL` was injected by `envsubst` at container startup and consumed by browser JavaScript. With nginx proxying `/api/` internally, the browser only ever calls the same public origin — no external backend URL is needed.

Change: `config.json.template` hardcoded to `{ "apiUrl": "" }`. The empty string causes browser JS to prefix API calls with `""`, resulting in relative paths (e.g., `/api/auth/login`) that nginx routes to the backend internally. `entrypoint.sh` is simplified from `envsubst` to a plain `cp` (no substitution needed). `API_URL` is removed from the frontend service environment in `docker-compose.yml`.

Note: `http://backend:8080` is the internal Docker address used in nginx's `proxy_pass` directive — it is the host that nginx connects to, not something the browser ever sees or uses.

### .env.example Change

Replace the existing `.env.example` with a fully documented version covering all variables referenced by docker-compose.yml, organized by category. Sections: Database, Security, Application URLs & CORS, Email (SMTP), Admin Bootstrap, User Lifecycle, Traefik Integration, Rate Limiting. `API_URL` is documented as empty-string for production (same-origin nginx proxy) with a note for direct-access dev use.

## Complexity Tracking

> No constitution violations. No complexity deviations required.
