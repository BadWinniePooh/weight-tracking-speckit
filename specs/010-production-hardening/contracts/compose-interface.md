# Contract: Docker Compose Stack Interface

**Feature**: 010-production-hardening
**Date**: 2026-03-17

This document defines the interface contract for operating the weight-tracking stack in production with Traefik integration. It covers environment variables, network topology, and the Traefik label interface.

---

## Environment Variables

All variables are supplied via a `.env` file at the repository root (or equivalent environment injection). Variables marked **required** have no default and the stack will not function correctly without them.

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | yes | `db` | Hostname of the PostgreSQL service. Use `db` for Docker Compose internal networking. |
| `DB_PORT` | yes | `5432` | Port PostgreSQL listens on. |
| `DB_NAME` | yes | — | Name of the PostgreSQL database. |
| `DB_USER` | yes | — | PostgreSQL username. |
| `DB_PASSWORD` | yes | — | PostgreSQL password. Must be changed from any default before internet-facing deployment. |

### JWT & Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | yes | — | HMAC signing secret for JWT tokens. Must be at least 32 characters. Generate with: `openssl rand -base64 32`. |

### Application URLs & CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_URL` | yes | — | Public URL of the app as seen by the browser (e.g., `https://weight.example.com`). Used by the frontend to construct API endpoint URLs. In production, this is the same as the public domain — nginx proxies `/api/` internally. |
| `ALLOWED_ORIGIN` | yes | — | CORS allowed origin — must match the URL users use to access the app (e.g., `https://weight.example.com`). |
| `APP_BASE_URL` | yes | `http://localhost:3000` | Public URL of the app used in outbound email links (e.g., password-reset URLs). Set to the same value as `API_URL` in production. |

### Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | no | `localhost` | Hostname of the SMTP server for outbound email (e.g., password resets). |
| `SMTP_PORT` | no | `1025` | SMTP server port. Use `587` for STARTTLS, `465` for SSL, `1025` for local MailHog. |
| `SMTP_USER` | no | _(empty)_ | SMTP authentication username. Leave blank if the SMTP server does not require authentication. |
| `SMTP_PASSWORD` | no | _(empty)_ | SMTP authentication password. Leave blank if unauthenticated. |
| `SMTP_SENDER_EMAIL` | no | `noreply@example.com` | From-address for outbound emails. |

### Admin Bootstrap

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_USERNAME` | no | — | Username for the auto-seeded admin account, created only when no users exist. Omit to use the interactive setup wizard instead. |
| `ADMIN_EMAIL` | no | — | Email address for the auto-seeded admin account. |
| `ADMIN_PASSWORD` | no | — | Password for the auto-seeded admin account. Must be changed after first login. |

### User Lifecycle

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `USER_DELETION_GRACE_DAYS` | no | `30` | Number of days a user account remains in a pending-deletion state before it is permanently removed. |

### Traefik Integration (new in this feature)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_DOMAIN` | yes | — | Public hostname for Traefik routing and TLS certificate (e.g., `weight.example.com`). No scheme, no trailing slash. |
| `TRAEFIK_NETWORK` | no | `traefik` | Name of the external Docker network that the existing Traefik instance uses for service discovery. |
| `TRAEFIK_CERT_RESOLVER` | no | `letsencrypt` | Name of the certificate resolver defined in Traefik's static configuration. Must match the resolver name in the Traefik deployment on the host. |

### Rate Limiting (new in this feature)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_RATE_LIMIT_AVERAGE` | no | `5` | Maximum average number of requests allowed to auth endpoints per period, per source IP. |
| `AUTH_RATE_LIMIT_PERIOD` | no | `1m` | Duration of the rate limit window (e.g., `1m` for one minute, `30s` for thirty seconds). |
| `AUTH_RATE_LIMIT_BURST` | no | `10` | Maximum burst above the average rate allowed before requests are rejected. |

---

## Network Topology

```
Internet
    │
    ▼
[Traefik] (external, pre-existing on host)
    │  (websecure entrypoint, TLS terminated here)
    │  external Docker network: ${TRAEFIK_NETWORK}
    ▼
[frontend / nginx]  port 80 (internal only — no host port binding)
    │  (default Docker Compose network)
    ├─ /api/* → proxy_pass http://backend:8080
    └─ /* → serve static SPA files

[backend]           port 8080 (internal only — no host port binding)
    │  (default Docker Compose network)
    └─ depends on: db (healthy)

[db / PostgreSQL]   port 5432 (internal only — no host port binding)
```

**Key invariants**:
- Only the `frontend` service joins the external Traefik network.
- `backend` and `db` are reachable only via the default Compose network — not from outside the stack.
- No service has `ports:` mappings in docker-compose.yml (for production; development overrides can be added via `docker-compose.override.yml`).

---

## Traefik Label Interface

The `frontend` service exposes the following Traefik routing contract via Docker labels.

### Routers

| Router name | Rule | Middleware | Notes |
|-------------|------|-----------|-------|
| `weight-tracker` | `Host(\`${APP_DOMAIN}\`)` | none | Catch-all; serves all non-auth traffic |
| `weight-tracker-auth` | `Host(\`${APP_DOMAIN}\`) && (Path(\`/api/auth/login\`) \| Path(\`/api/auth/reset-password/request\`))` | `weight-tracker-auth-ratelimit` | Auth paths only; priority 10 |

Both routers use the `websecure` entrypoint and TLS with `${TRAEFIK_CERT_RESOLVER}`.

### Middlewares

| Middleware name | Type | Configuration |
|-----------------|------|---------------|
| `weight-tracker-auth-ratelimit` | ratelimit | average: `${AUTH_RATE_LIMIT_AVERAGE}`, period: `${AUTH_RATE_LIMIT_PERIOD}`, burst: `${AUTH_RATE_LIMIT_BURST}` |

### Service

| Service name | Target |
|--------------|--------|
| `weight-tracker` | `frontend` container port 80 |

---

## Affected Files

| File | Change type | Description |
|------|------------|-------------|
| `docker-compose.yml` | Modified | Remove backend/frontend host ports; add Traefik labels to frontend; declare external Traefik network; attach frontend to Traefik network |
| `frontend/nginx.conf` | Modified | Add `location /api/` proxy_pass block to route API calls to backend |
| `.env.example` | Modified | Complete documentation of all env vars including new Traefik/rate-limit vars and previously undocumented SMTP/admin vars |
