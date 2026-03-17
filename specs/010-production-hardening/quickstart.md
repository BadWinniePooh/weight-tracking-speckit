# Quickstart: Production Deployment with Traefik

**Feature**: 010-production-hardening
**Date**: 2026-03-17

This guide covers deploying the weight-tracking stack on a self-hosted server behind an existing Traefik instance.

---

## Prerequisites

- Docker and Docker Compose v2 installed on the server.
- An existing Traefik instance running on the server with:
  - A Docker network for service discovery (commonly named `traefik`).
  - A `websecure` entrypoint (typically port 443).
  - A certificate resolver configured (commonly named `letsencrypt`).
- A DNS record pointing your chosen domain to the server's IP address.

---

## Setup

### 1. Clone and configure

```bash
git clone <repo-url> weight-tracking
cd weight-tracking
cp .env.example .env
```

Edit `.env` and fill in every value. Required values have no default and must be set:

| Variable | Example value |
|----------|--------------|
| `APP_DOMAIN` | `weight.example.com` |
| `DB_NAME` | `weighttracker` |
| `DB_USER` | `weighttracker` |
| `DB_PASSWORD` | *(generate a strong password)* |
| `JWT_SECRET` | *(run: `openssl rand -base64 32`)* |
| `API_URL` | `https://weight.example.com` |
| `ALLOWED_ORIGIN` | `https://weight.example.com` |
| `APP_BASE_URL` | `https://weight.example.com` |

For SMTP, fill in `SMTP_HOST`, `SMTP_PORT`, etc. if you want email (password reset). If you omit these, the defaults point to a local MailHog instance that won't be running in production — password-reset emails will silently fail. Set real SMTP values for production.

### 2. Verify Traefik network name

Check the network your Traefik instance uses:

```bash
docker network ls
```

If the name is not `traefik`, set `TRAEFIK_NETWORK=<name>` in `.env`.

Check your Traefik static config for the cert resolver name (commonly `letsencrypt`). Set `TRAEFIK_CERT_RESOLVER=<name>` if different.

### 3. Start the stack

```bash
docker compose up -d
```

Traefik will automatically discover the frontend service via Docker labels and obtain a TLS certificate. DNS must be pointing to the server before running this step or certificate issuance will fail.

### 4. Verify

```bash
# Check all services are healthy
docker compose ps

# Check logs for any startup errors
docker compose logs --follow
```

Open `https://<APP_DOMAIN>` in a browser. You should see the login page over HTTPS with a valid certificate.

---

## Verifying Port Closure

Confirm that backend and database are not reachable from outside:

```bash
# From the server (or any external host):
# These should all refuse or time out:
curl http://localhost:8080/health    # backend — should be refused
curl http://localhost:5432           # postgres — should be refused
```

---

## Verifying Rate Limiting

Send more than 5 requests to the login endpoint within a minute:

```bash
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://<APP_DOMAIN>/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done
```

The first requests will return `400`/`401` (application-level rejection). After the rate limit is exceeded, requests will return `429 Too Many Requests` from Traefik.

---

## Development (Local) Override

For local development, backend and frontend ports are still useful. Create a `docker-compose.override.yml` (not committed, add to `.gitignore`) to re-enable ports without modifying the production file:

```yaml
services:
  backend:
    ports:
      - "8080:8080"
  frontend:
    ports:
      - "3000:80"
```

---

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

Data is preserved in the `weighttracker-data` Docker volume.
