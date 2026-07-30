# Tasks: Production Hardening for Self-Hosted Deployment

**Input**: Design documents from `/specs/010-production-hardening/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, contracts/compose-interface.md ✅, quickstart.md ✅

**Tests**: No automated test tasks — this is a pure infrastructure/configuration change. Verification steps are manual, documented in quickstart.md and in each checkpoint below.

**Organization**: Tasks grouped by user story to enable independent delivery of each security increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: nginx API proxy and API_URL configuration change that MUST be complete before closing the backend port (US1). Without the nginx proxy_pass, removing the backend host port would break all browser API calls.

**⚠️ CRITICAL**: US1 and all subsequent user stories depend on this phase.

- [x] T001 Add `location /api/` proxy_pass block to `frontend/nginx.conf`, proxying to `http://backend:8080` with forwarded headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`). Insert before the existing `location /` catch-all block.

- [x] T002 Update `frontend/public/config.json.template`: change the `apiUrl` value from `"${API_URL}"` to `""` (empty string). With nginx now proxying `/api/` internally, the browser fetches the same origin — no external backend URL is needed in the browser config. The `API_URL` environment variable and the `docker-compose.yml` frontend environment section must also be updated: remove `API_URL: ${API_URL}` from the frontend service (or set it to `""`) in `docker-compose.yml`. Update the `entrypoint.sh` if it references `$API_URL` for substitution (remove `$API_URL` from the `envsubst` argument if config.json.template no longer uses it).

**Note on API_URL**: `http://backend:8080` is the internal Docker address that nginx uses in its `proxy_pass` directive (hardcoded in `nginx.conf`) — it is NOT a browser-facing value and must NOT appear in `config.json`. The browser always calls the same public origin; nginx routes `/api/` requests to the backend internally.

**Checkpoint**: Rebuild the frontend Docker image and start the full stack. Confirm `config.json` is served as `{"apiUrl":""}` and the app still loads and makes API calls successfully (via nginx proxy to backend).

---

## Phase 2: User Story 1 — Internal Services Not Directly Reachable (Priority: P1) 🎯 MVP

**Goal**: Close the backend host port so that no services other than the frontend are reachable from outside the Docker network.

**Independent Test**: After applying, attempt `curl http://localhost:8080/health` on the host — should be refused. Confirm the running app still makes successful API calls.

- [x] T003 [US1] Remove `ports: - "8080:8080"` from the `backend` service in `docker-compose.yml`. The backend remains reachable internally on `http://backend:8080` for nginx and for the health-check command (which uses `localhost` inside the container — no change needed there).

**Checkpoint**: Stop and restart the stack (`docker compose up -d --build`). Verify:
1. `curl http://localhost:8080/health` fails with "Connection refused".
2. The web app loads and login works (nginx proxies API calls to backend internally).
3. `curl http://localhost:5432` also fails (database — already had no host port, confirm).

---

## Phase 3: User Story 2 — App Served Securely via Traefik (Priority: P2)

**Goal**: Route the frontend through the existing external Traefik instance with TLS. Remove the frontend's direct host port.

**Independent Test**: After applying (with a running Traefik and valid `APP_DOMAIN`), `https://<APP_DOMAIN>` loads the app with a valid TLS certificate. Accessing the domain over HTTP redirects to HTTPS (Traefik global redirect).

- [x] T004 [P] [US2] Declare the external Traefik network at the bottom of `docker-compose.yml`, replacing the existing `volumes:` + trailing content with an updated version that includes a `networks:` section:

  ```yaml
  networks:
    traefik:
      external: true
      name: ${TRAEFIK_NETWORK:-traefik}
  ```

- [x] T005 [US2] Add Traefik labels and network attachment to the `frontend` service in `docker-compose.yml`. Remove `ports: - "3000:80"`. Add `networks: [default, traefik]` to the frontend service so it is reachable both by the backend (default network) and by Traefik (external network). Add Docker labels for the catch-all router (no rate limiting yet):

  ```yaml
  labels:
    - "traefik.enable=true"
    - "traefik.docker.network=${TRAEFIK_NETWORK:-traefik}"
    - "traefik.http.services.weight-tracker.loadbalancer.server.port=80"
    - "traefik.http.routers.weight-tracker.rule=Host(`${APP_DOMAIN}`)"
    - "traefik.http.routers.weight-tracker.entrypoints=websecure"
    - "traefik.http.routers.weight-tracker.tls=true"
    - "traefik.http.routers.weight-tracker.tls.certresolver=${TRAEFIK_CERT_RESOLVER:-letsencrypt}"
  ```

**Checkpoint**: With `APP_DOMAIN`, `TRAEFIK_NETWORK`, and `TRAEFIK_CERT_RESOLVER` set in `.env` and the Traefik instance running, restart the stack. Verify `https://<APP_DOMAIN>` loads the app with valid HTTPS. Verify `curl http://localhost:3000` is now refused (no host port).

---

## Phase 4: User Story 3 — Auth Endpoints Rate-Limited (Priority: P3)

**Goal**: Add a Traefik rate-limit middleware on the two auth paths to prevent brute-force attacks.

**Independent Test**: Send more than 10 requests to `/api/auth/login` within one minute — requests beyond the burst limit should receive HTTP 429.

- [x] T006 [US3] Add the auth-specific router and rate-limit middleware to the `frontend` service labels in `docker-compose.yml`. Append to the existing `labels:` block (do not replace the catch-all router from T005):

  ```yaml
    # Auth-specific router (rate limited, higher priority)
    - "traefik.http.routers.weight-tracker-auth.rule=Host(`${APP_DOMAIN}`) && (Path(`/api/auth/login`) || Path(`/api/auth/reset-password/request`))"
    - "traefik.http.routers.weight-tracker-auth.priority=10"
    - "traefik.http.routers.weight-tracker-auth.entrypoints=websecure"
    - "traefik.http.routers.weight-tracker-auth.tls=true"
    - "traefik.http.routers.weight-tracker-auth.tls.certresolver=${TRAEFIK_CERT_RESOLVER:-letsencrypt}"
    - "traefik.http.routers.weight-tracker-auth.service=weight-tracker"
    - "traefik.http.routers.weight-tracker-auth.middlewares=weight-tracker-auth-ratelimit"
    # Rate limit middleware (5 requests per minute average, burst 10)
    - "traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.average=${AUTH_RATE_LIMIT_AVERAGE:-5}"
    - "traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.period=${AUTH_RATE_LIMIT_PERIOD:-1m}"
    - "traefik.http.middlewares.weight-tracker-auth-ratelimit.ratelimit.burst=${AUTH_RATE_LIMIT_BURST:-10}"
  ```

**Checkpoint**: Restart the stack (`docker compose up -d` — no rebuild needed, labels are runtime). Run the rate limit verification loop from `quickstart.md`. Confirm requests beyond the burst limit return `429`.

---

## Phase 5: User Story 4 — Fully Documented .env.example (Priority: P4)

**Goal**: Every environment variable referenced by the stack is documented with purpose, format, and optional/required status.

**Independent Test**: Compare every `${VAR}` reference in `docker-compose.yml` against `.env.example` — no variable is absent. Each entry has a comment.

- [x] T007 [US4] Rewrite `.env.example` at the repository root with full documentation. Replace the current 21-line file with a fully commented version organized into sections. Every variable below must be present with a description comment:

  **Section: Database**
  - `DB_HOST=db` — Hostname of the PostgreSQL service; use `db` for Docker Compose internal networking
  - `DB_PORT=5432` — Port PostgreSQL listens on
  - `DB_NAME=weighttracker` — Name of the PostgreSQL database
  - `DB_USER=weighttracker` — PostgreSQL username
  - `DB_PASSWORD=change_me` — PostgreSQL password; CHANGE before internet-facing deployment

  **Section: Security**
  - `JWT_SECRET=change_me_generate_with_openssl_rand_base64_32` — JWT signing secret; must be at least 32 chars; generate with `openssl rand -base64 32`

  **Section: Application URLs & CORS**
  - `API_URL=` — Leave empty (same-origin). The browser calls the same public domain; nginx routes `/api/` to the backend internally. Set to the full backend URL only for direct-access local development without nginx proxy.
  - `ALLOWED_ORIGIN=https://your-domain.example.com` — CORS allowed origin; must match the URL users access the app from
  - `APP_BASE_URL=https://your-domain.example.com` — Public URL used in outbound email links (e.g., password-reset URLs)

  **Section: Email (SMTP)**
  - `SMTP_HOST=localhost` — Hostname of the SMTP server for outbound email
  - `SMTP_PORT=1025` — SMTP port; use 587 for STARTTLS, 465 for SSL/TLS, 1025 for local MailHog
  - `SMTP_USER=` — SMTP authentication username; leave blank if unauthenticated
  - `SMTP_PASSWORD=` — SMTP authentication password; leave blank if unauthenticated
  - `SMTP_SENDER_EMAIL=noreply@example.com` — From-address for outbound emails

  **Section: Admin Bootstrap**
  - `# ADMIN_USERNAME=admin` — (commented out) Username for the auto-seeded admin; created only on first run when no users exist; omit to use the setup wizard
  - `# ADMIN_EMAIL=admin@example.com` — (commented out) Email for the auto-seeded admin
  - `# ADMIN_PASSWORD=change_me` — (commented out) Password for the auto-seeded admin; change after first login

  **Section: User Lifecycle**
  - `USER_DELETION_GRACE_DAYS=30` — Days before a pending-deletion account is permanently removed

  **Section: Traefik Integration**
  - `APP_DOMAIN=weight.example.com` — Public hostname (no scheme, no trailing slash); used for Traefik routing and TLS certificate; REQUIRED
  - `TRAEFIK_NETWORK=traefik` — Name of the external Docker network the existing Traefik instance uses
  - `TRAEFIK_CERT_RESOLVER=letsencrypt` — Name of the cert resolver defined in Traefik's static config (must match Traefik's configuration)

  **Section: Rate Limiting**
  - `AUTH_RATE_LIMIT_AVERAGE=5` — Max requests to auth endpoints per period per source IP (token bucket average)
  - `AUTH_RATE_LIMIT_PERIOD=1m` — Rate limit window (e.g., `1m`, `30s`)
  - `AUTH_RATE_LIMIT_BURST=10` — Burst allowance above the average before requests are rejected

**Checkpoint**: Count every `${VAR}` in `docker-compose.yml`. Confirm each has a matching entry in `.env.example` with a non-empty comment.

---

## Phase 6: Polish & Verification

**Purpose**: End-to-end validation per quickstart.md acceptance criteria.

- [x] T008 [P] Run full manual verification from `specs/010-production-hardening/quickstart.md`: port closure test, HTTPS routing, rate-limit loop, `.env.example` coverage check. Document any findings.

- [x] T009 [P] Update `specs/010-production-hardening/plan.md` Implementation Design section to note the `config.json.template` `apiUrl` → `""` change (discovered constraint added during task generation). Ensures the plan accurately reflects what was implemented.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start here
- **Phase 2 (US1)**: Depends on Phase 1 complete (nginx proxy must be in place before closing backend port)
- **Phase 3 (US2)**: Depends on Phase 2 (frontend port removed; Traefik takes over as entry point)
- **Phase 4 (US3)**: Depends on Phase 3 (Traefik routing must work before rate limiting applies)
- **Phase 5 (US4)**: Independent — can run any time after Phase 1 (but do last to include all new vars)
- **Phase 6 (Polish)**: Depends on Phases 2–5 complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 1 (foundational) complete
- **US2 (P2)**: Requires US1 complete (frontend port removal ties these together)
- **US3 (P3)**: Requires US2 complete (Traefik must be routing)
- **US4 (P4)**: Independent of US1–US3 (pure documentation)

### Within Each Phase

- Foundational: T001 then T002 (T002 may remove reference to `$API_URL` that affects the entrypoint.sh call)
- US2: T004 and T005 can be done in parallel (different concerns in the same file section) but both commit together
- Polish: T008 and T009 can run in parallel

### Parallel Opportunities

```bash
# Phase 3 (US2): T004 and T005 touch different parts of docker-compose.yml — can draft both then commit together
# Phase 6: T008 and T009 are independent
```

---

## Implementation Strategy

### MVP First (US1 — Port Closure)

1. Complete Phase 1 (Foundational): nginx proxy_pass + apiUrl → `""`
2. Complete Phase 2 (US1): close backend port
3. **STOP and VALIDATE**: backend port refused, app still functional
4. This delivers the primary security goal with minimal changes

### Incremental Delivery

1. Phase 1 → Phase 2 (US1): Backend port closed, nginx proxying ✅
2. Phase 3 (US2): Traefik routing live, HTTPS working ✅
3. Phase 4 (US3): Rate limiting on auth endpoints ✅
4. Phase 5 (US4): Full .env.example documentation ✅
5. Phase 6: End-to-end verification ✅

Each phase adds a complete, independently verifiable security improvement.

---

## Notes

- All changes are to 3 files: `docker-compose.yml`, `frontend/nginx.conf`, `frontend/public/config.json.template`, plus `.env.example`
- No backend or frontend application source code changes
- `frontend/entrypoint.sh` may need a minor update if `$API_URL` is removed from the envsubst argument (check: if `config.json.template` no longer contains `${API_URL}`, the `envsubst` call can drop `'$API_URL'` — or keep it harmlessly)
- Commit after each completed phase (per constitution commit cadence)
- Rate limiting via Traefik labels is purely additive — no restart required beyond `docker compose up -d`
