# Deployment Guide

This guide covers everything required to deploy Weight Tracker on your own server with HTTPS via Traefik. Follow the sections in order for a fresh deployment.

---

## Prerequisites

- **Docker Engine** 20.10 or later
- **Docker Compose** v2.0 or later (`docker compose` command, not `docker-compose`)
- **A domain name** with a DNS A record pointing to your server's IP address
- **Traefik** already running on the host with:
  - An external Docker network (default name: `traefik`) that Traefik monitors for service discovery
  - A certificate resolver (e.g. `letsencrypt`) configured in Traefik's static configuration for automatic TLS via Let's Encrypt

> **Note**: This guide documents how to configure the Weight Tracker application to work with an existing Traefik instance. It does not cover installing or configuring Traefik itself.

---

## Environment Variables

Copy the example file to create your `.env`:

```sh
cp .env.example .env
```

Open `.env` in a text editor and set the values below. Variables marked **Required** must be changed from their placeholder values before starting the stack.

### Database

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `DB_HOST` | Hostname of the PostgreSQL service. Use `db` for Docker Compose internal networking. | No | `db` | `db` |
| `DB_PORT` | Port PostgreSQL listens on. | No | `5432` | `5432` |
| `DB_NAME` | Name of the PostgreSQL database. | No | `weighttracker` | `weighttracker` |
| `DB_USER` | PostgreSQL username. | No | `weighttracker` | `weighttracker` |
| `DB_PASSWORD` | PostgreSQL password. Change this before exposing the app to any network. | **Yes** | `change_me` | `s3cur3passw0rd!` |

### Security

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `JWT_SECRET` | JWT signing secret. Must be at least 32 characters. Generate with: `openssl rand -base64 32` | **Yes** | `change_me_...` | *(output of openssl command)* |

### Application URLs & CORS

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `API_URL` | Base URL for API calls from the browser. Leave empty (`""`) when using the nginx proxy (production default). Only set to the backend URL for direct-access local development. | No | `""` | `""` |
| `ALLOWED_ORIGIN` | CORS allowed origin — must exactly match the URL users type to reach the app (same scheme, host, and port). | **Yes** | *(placeholder)* | `https://weight.example.com` |
| `APP_BASE_URL` | Public URL used in outbound email links (e.g. password-reset URLs). | **Yes** | `http://localhost:3000` | `https://weight.example.com` |

### Email (SMTP)

All SMTP variables are optional. If not configured, outbound emails (password-reset, email confirmation) will fail silently.

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `SMTP_HOST` | Hostname of the SMTP server. | No | `localhost` | `smtp.mailgun.org` |
| `SMTP_PORT` | SMTP server port. Common values: `587` (STARTTLS), `465` (SSL/TLS), `1025` (local MailHog). | No | `1025` | `587` |
| `SMTP_USER` | SMTP authentication username. Leave blank if the server does not require auth. | No | *(blank)* | `postmaster@mg.example.com` |
| `SMTP_PASSWORD` | SMTP authentication password. Leave blank if the server does not require auth. | No | *(blank)* | `smtp-secret` |
| `SMTP_SENDER_EMAIL` | From-address for outbound emails. | No | `noreply@example.com` | `weight@example.com` |

### Admin Bootstrap

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `ADMIN_USERNAME` | Username for the auto-seeded admin account. Only used when the `Users` table is empty on first startup. Leave unset to use the interactive setup wizard instead. | No | *(unset)* | `admin` |
| `ADMIN_EMAIL` | Email for the auto-seeded admin account. | No | *(unset)* | `admin@example.com` |
| `ADMIN_PASSWORD` | Password for the auto-seeded admin account. Change immediately after first login. | No | *(unset)* | `InitialPass123!` |

### User Lifecycle

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `USER_DELETION_GRACE_DAYS` | Number of days an account remains in pending-deletion state before permanent removal. | No | `30` | `30` |

### Traefik Integration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `APP_DOMAIN` | Public hostname for Traefik routing and TLS certificate. No scheme, no trailing slash. | **Yes** | `weight.example.com` | `weight.example.com` |
| `TRAEFIK_NETWORK` | Name of the external Docker network that Traefik uses for service discovery. Must match your Traefik deployment. | No | `traefik` | `traefik` |
| `TRAEFIK_CERT_RESOLVER` | Name of the certificate resolver in Traefik's static config. Must match your Traefik deployment. | No | `letsencrypt` | `letsencrypt` |

### Rate Limiting

These variables control the per-IP rate limit applied by Traefik to `/api/auth/login` and `/api/auth/reset-password/request`.

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AUTH_RATE_LIMIT_AVERAGE` | Maximum average number of requests per period per source IP. | No | `5` | `5` |
| `AUTH_RATE_LIMIT_PERIOD` | Duration of the rate limit window. | No | `1m` | `1m` |
| `AUTH_RATE_LIMIT_BURST` | Maximum burst of requests allowed above the average before rejecting. | No | `10` | `10` |

---

## Docker Compose Startup

**Step 1** — Configure environment:

```sh
cp .env.example .env
# Edit .env and set at minimum: DB_PASSWORD, JWT_SECRET, ALLOWED_ORIGIN, APP_BASE_URL, APP_DOMAIN
```

**Step 2** — Start the stack:

```sh
docker compose up -d
```

All containers start in dependency order: `db` first, then `backend` once the database is healthy, then `frontend` once the backend is healthy.

**Step 3** — Verify all services are healthy:

```sh
docker compose ps
```

All three services (`db`, `backend`, `frontend`) should show `(healthy)` status.

**Step 4** — Open the app in a browser:

```
https://your-domain.example.com
```

On first startup with no existing users, the app redirects to the setup wizard (see [First-Run Setup](#first-run-setup) below).

> **Warning**: Never run `docker compose down -v` — the `-v` flag destroys all named volumes, permanently deleting your database.

---

## Traefik TLS Configuration

The `docker-compose.yml` in this repository uses Traefik labels to configure HTTPS routing automatically. No manual Traefik configuration file is needed; service discovery happens via Docker labels.

### How it works

The `frontend` container exposes two Traefik routers:

1. **Catch-all router** (`weight-tracker`) — handles all requests to `APP_DOMAIN` over HTTPS. TLS is terminated by Traefik using the certificate resolver specified by `TRAEFIK_CERT_RESOLVER`. Traffic is forwarded to the nginx container on port 80.

2. **Auth rate-limit router** (`weight-tracker-auth`) — handles only `/api/auth/login` and `/api/auth/reset-password/request` with higher priority. Applies the `weight-tracker-auth-ratelimit` middleware, which enforces per-IP rate limiting (`AUTH_RATE_LIMIT_AVERAGE` requests per `AUTH_RATE_LIMIT_PERIOD`, burst up to `AUTH_RATE_LIMIT_BURST`). This prevents brute-force attacks on login and password-reset endpoints.

### Requirements

- Traefik must be running on the same Docker host with a network named `TRAEFIK_NETWORK` (default: `traefik`).
- The `traefik` external network must be declared in your Traefik deployment and must use the name matching `TRAEFIK_NETWORK`.
- The certificate resolver named by `TRAEFIK_CERT_RESOLVER` must be configured in Traefik's static configuration (e.g. a Let's Encrypt ACME resolver).
- Port 443 must be open on the host and reachable from the internet for Let's Encrypt ACME challenges to succeed.

### Verifying TLS

After startup, open `https://your-domain.example.com` in a browser. A valid TLS certificate issued by Let's Encrypt (or your configured resolver) confirms that Traefik is routing and terminating HTTPS correctly.

---

## First-Run Setup

On first startup, the app detects that no admin account exists and shows a setup wizard.

### Option A — Interactive setup wizard

Leave `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` unset (or commented out) in `.env`. After starting the stack, open `https://your-domain.example.com` in a browser — you will be redirected to `/setup.html` to create the initial admin account interactively.

> **HTTPS required**: The refresh token is stored in an `HttpOnly SameSite=Strict` cookie. Browsers block this cookie on plain HTTP. The setup wizard and login will not work correctly without HTTPS.

Once any user exists, the setup endpoint returns `409 Conflict` and `/setup.html` is no longer accessible.

### Option B — Environment variable seeding

Set all three admin variables in `.env` before the first `docker compose up`:

```sh
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong password>
```

On startup, the backend detects that no users exist and automatically creates the admin account. All three variables must be set; if any are missing the seeder skips creation and logs a warning.

> **Note**: After the admin account is created, changing these variables has no effect — the seeder only runs when the `Users` table is empty.

Change the admin password immediately after first login.

---

## Backup & Restore

For backup and restore procedures, see [docs/backup.md](backup.md).
