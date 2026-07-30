# Research: Production Hardening for Self-Hosted Deployment

**Feature**: 010-production-hardening
**Date**: 2026-03-17
**Status**: Complete — all unknowns resolved

---

## Decision 1: Ingress Architecture (Single Nginx vs Dual Traefik Routes)

**Question**: Should the backend be exposed directly via its own Traefik labels (giving it its own route), or should the frontend nginx act as the single ingress and proxy API calls internally?

**Decision**: Frontend nginx as the sole external ingress. Nginx proxies `/api/` requests to the backend internally.

**Rationale**:
- The spec requires that "only the frontend (nginx) should be reachable" — dual Traefik routes would make the backend independently reachable externally, which conflicts with this intent.
- Proxying through nginx keeps a clean security perimeter: one service faces the internet.
- Traefik rate limiting on auth paths applies at the nginx entry point before the request even reaches the backend.
- The existing `API_URL` env var continues to work: in production it is set to the public app URL (e.g., `https://weight.example.com`), the browser calls the same origin, nginx routes `/api/` to backend internally.

**Alternatives Considered**:
- Expose backend via its own Traefik subdomain (`api.domain.com`): rejected because it violates "only frontend reachable" and requires managing two TLS certificates.
- Expose backend via Traefik path prefix (`/api/`) and attach Traefik directly to backend: rejected for same reason — backend would be independently reachable through Traefik.

**Implementation impact**: `frontend/nginx.conf` must gain a `location /api/` block that proxies to `http://backend:8080`. This is the only nginx change and is strictly necessary to enable internal networking.

---

## Decision 2: Traefik Version Target

**Question**: Which Traefik major version should the labels target?

**Decision**: Traefik v2.x label format as the primary target; the configuration is forward-compatible with Traefik v3.x.

**Rationale**:
- Traefik v2 is the most widely deployed version in self-hosted setups.
- The label syntax used in this plan (`traefik.http.routers.*`, `traefik.http.middlewares.*`) is identical between v2 and v3 for the features used here (routing rules, TLS, ratelimit middleware).
- No v3-only features are required.

**Alternatives Considered**:
- Target v3 exclusively: rejected because it would break deployments still on v2.

---

## Decision 3: Rate Limiting Configuration Defaults

**Question**: What rate limit values should be the defaults for the auth endpoints?

**Decision**: 5 requests per minute average, burst of 10, per source IP.

**Rationale**:
- 5 requests/minute allows a human to attempt login 5 times per minute (enough for forgotten passwords) while blocking automated credential stuffing (which operates at hundreds of requests per second).
- Burst of 10 absorbs short legitimate spikes (e.g., a double-click or a page reload) without triggering the limit.
- Traefik's ratelimit middleware tracks per source IP by default; no additional source configuration needed.
- All three values are environment-variable-configurable so operators can tune without editing compose files.

**Alternatives Considered**:
- 10/minute: slightly more permissive; 5/minute is the industry standard floor for login rate limiting.
- 1/minute: too restrictive for human use (a user who misremembers a password can't retry promptly).
- Window-based (10 attempts then block): Traefik's token bucket model approximates this well at 5/min average.

**Traefik ratelimit label values**:
- `ratelimit.average`: `${AUTH_RATE_LIMIT_AVERAGE:-5}` (5 requests)
- `ratelimit.period`: `${AUTH_RATE_LIMIT_PERIOD:-1m}` (per minute)
- `ratelimit.burst`: `${AUTH_RATE_LIMIT_BURST:-10}` (burst allowance)

---

## Decision 4: Routing — General vs Auth-Specific Routers

**Question**: How should Traefik distinguish between auth paths (rate-limited) and all other paths (not rate-limited) when both go to the same nginx container?

**Decision**: Two routers on the same service. Router `weight-tracker-auth` matches the two auth paths with an explicit `priority` value to ensure it takes precedence over the catch-all router `weight-tracker`.

**Rationale**:
- Traefik supports multiple routers pointing to the same service, each with its own middleware set.
- The auth router uses a compound rule: `Host(\`domain\`) && (Path(\`/api/auth/login\`) || Path(\`/api/auth/reset-password/request\`))`, which has higher specificity than the catch-all `Host(\`domain\`)`.
- Explicit `priority=10` on the auth router (default priority for catch-all is 1) guarantees correct precedence regardless of Traefik version behaviour for automatic priority calculation.

**Label structure**:
```
# Catch-all router (no rate limit)
traefik.http.routers.weight-tracker.rule=Host(`${APP_DOMAIN}`)
traefik.http.routers.weight-tracker.entrypoints=websecure
traefik.http.routers.weight-tracker.tls=true

# Auth-specific router (rate limited)
traefik.http.routers.weight-tracker-auth.rule=Host(`${APP_DOMAIN}`) && (Path(`/api/auth/login`) || Path(`/api/auth/reset-password/request`))
traefik.http.routers.weight-tracker-auth.priority=10
traefik.http.routers.weight-tracker-auth.entrypoints=websecure
traefik.http.routers.weight-tracker-auth.tls=true
traefik.http.routers.weight-tracker-auth.service=weight-tracker
traefik.http.routers.weight-tracker-auth.middlewares=weight-tracker-auth-ratelimit

# Service target (explicit for the auth router)
traefik.http.services.weight-tracker.loadbalancer.server.port=80

# Rate limit middleware
traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.average=5
traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.period=1m
traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.burst=10
```

---

## Decision 5: TLS Certificate Resolver

**Question**: How should TLS be configured? Which cert resolver name to use?

**Decision**: Reference the Traefik cert resolver by name via an environment variable `TRAEFIK_CERT_RESOLVER`, defaulting to `letsencrypt`.

**Rationale**:
- Traefik cert resolvers are defined in Traefik's static configuration on the host. The app doesn't control them.
- The most common self-hosted resolver name is `letsencrypt`. Making it configurable covers setups with different resolver names (e.g., `cloudflare`, `internal-ca`).
- Setting `tls=true` without a `certresolver` makes Traefik use a self-signed cert — requiring the resolver is the correct production approach.

---

## Decision 6: External Traefik Network Configuration

**Question**: How should the external Traefik network be declared and connected?

**Decision**: Declare `traefik` as an external network in the compose file, with the network name configurable via `TRAEFIK_NETWORK` env var (default: `traefik`). The frontend service joins this network in addition to the default internal network.

**Rationale**:
- Docker Compose external networks require explicit declaration so Compose doesn't try to create them.
- The frontend needs to be on both: the default network (to reach the backend) and the Traefik network (to be discovered by Traefik).
- Backend and database only need the default network — they have no reason to be visible to Traefik.

**Compose network declaration**:
```yaml
networks:
  traefik:
    external: true
    name: ${TRAEFIK_NETWORK:-traefik}
```

---

## Decision 7: New Environment Variables

The following new env vars will be added to `.env.example`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_DOMAIN` | (required) | Public hostname for Traefik routing and TLS certificate (e.g., `weight.example.com`) |
| `TRAEFIK_NETWORK` | `traefik` | Name of the external Docker network the Traefik instance uses |
| `TRAEFIK_CERT_RESOLVER` | `letsencrypt` | Name of the cert resolver defined in Traefik's static config |
| `AUTH_RATE_LIMIT_AVERAGE` | `5` | Max requests to auth endpoints per period (token bucket average) |
| `AUTH_RATE_LIMIT_PERIOD` | `1m` | Duration of the rate limit window (e.g., `1m`, `30s`) |
| `AUTH_RATE_LIMIT_BURST` | `10` | Maximum burst allowance above the average rate |

Existing undocumented env vars that will be added to `.env.example`:

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST` | Hostname of the SMTP server for outbound email |
| `SMTP_PORT` | SMTP server port (typically 587 for STARTTLS, 465 for SSL) |
| `SMTP_USER` | SMTP authentication username (leave blank if unauthenticated) |
| `SMTP_PASSWORD` | SMTP authentication password (leave blank if unauthenticated) |
| `SMTP_SENDER_EMAIL` | From-address for outbound emails (e.g., noreply@example.com) |
| `APP_BASE_URL` | Public URL of the app, used in email links (e.g., https://weight.example.com) |
| `USER_DELETION_GRACE_DAYS` | Days a user account remains in pending-deletion state before hard delete |
| `ADMIN_USERNAME` | Username for the auto-seeded admin account (bootstrap only) |
| `ADMIN_EMAIL` | Email for the auto-seeded admin account |
| `ADMIN_PASSWORD` | Password for the auto-seeded admin account |
