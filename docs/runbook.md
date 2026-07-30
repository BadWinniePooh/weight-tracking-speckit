# Weight Tracker — Operator Runbook

This runbook covers operational procedures for a self-hosted Weight Tracker instance running via Docker Compose. It covers health checks, version upgrades, rollbacks, and troubleshooting.

For initial setup and configuration, see the [Deployment Guide](deployment.md).

## Table of Contents

1. [Health Checks](#health-checks)
2. [Updating to a New Version](#updating-to-a-new-version)
3. [Rolling Back a Failed Update](#rolling-back-a-failed-update)
4. [Backup & Restore](#backup--restore)
5. [Troubleshooting](#troubleshooting)

---

## Health Checks

Run these checks to confirm all services are operating normally.

**Step 1 — Verify all containers are healthy**:

```sh
docker compose ps
```

All three services (`db`, `backend`, `frontend`) must show `(healthy)` status. Any service showing `(unhealthy)` or `(starting)` for more than 60 seconds indicates a problem.

**Step 2 — Verify the backend health endpoint**:

```sh
docker compose exec backend wget -qO- http://localhost:8080/health
```

A healthy response returns HTTP 200 with a JSON body confirming database connectivity. An empty response or a non-200 status indicates a backend or database connectivity problem.

**Step 3 — Inspect service logs** (use when a service is unhealthy):

```sh
# Follow live logs for a specific service
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f frontend
```

Replace the service name with the one showing an unhealthy status. Look for error lines near the end of the output.

---

## Updating to a New Version

Pull the latest source code:

```sh
git pull
```

Rebuild images and restart containers:

```sh
docker compose up --build -d
```

Docker Compose rebuilds only the images that have changed and replaces the running containers. The named volume `weighttracker-data` stores all PostgreSQL data and is completely unaffected by image rebuilds — your data is preserved.

> **Warning**: **Never run `docker compose down -v`** during an update. The `-v` flag destroys all named volumes, permanently deleting your database. Use `docker compose up --build -d` for updates instead.

---

## Rolling Back a Failed Update

Check out the previous working commit or tag:

```sh
git checkout <previous-commit-or-tag>
```

Rebuild and restart the stack:

```sh
docker compose up --build -d
```

The named volume `weighttracker-data` is decoupled from the application images — all data is preserved across rollbacks. Only the application code changes; the database continues from where it was.

---

## Backup & Restore

For all backup and restore procedures, see [docs/backup.md](backup.md).

---

## Troubleshooting

### Container won't start

View startup error output:

```sh
docker compose logs backend
docker compose logs db
```

Common causes:

- `.env` file does not exist — create it by running `cp .env.example .env` and filling in all required values (see [Deployment Guide](deployment.md))
- A required variable in `.env` has been left empty — Docker Compose substitutes empty strings, which causes the backend to fail to build a valid connection string

### Database connection errors

Verify that the five database variables in `.env` are consistent with what the `db` service is configured with:

- `DB_HOST` — must be `db` when using Docker Compose internal networking
- `DB_PORT` — must match the port PostgreSQL listens on (default `5432`)
- `DB_NAME` — must match `POSTGRES_DB` used to initialise the database
- `DB_USER` — must match `POSTGRES_USER` used to initialise the database
- `DB_PASSWORD` — must match `POSTGRES_PASSWORD` used to initialise the database

Confirm the database service is healthy:

```sh
docker compose ps
```

If the `db` service shows an unhealthy status, check its logs with `docker compose logs db`.

### Frontend can't reach backend (CORS error)

The browser console shows: `Access-Control-Allow-Origin header missing` or a CORS-related network error.

In the production nginx-proxied setup, `API_URL` in `.env` should be empty (`""`). The nginx container routes `/api/*` requests internally to the backend, so the browser never makes a cross-origin request. If `API_URL` is set to an absolute backend URL, the browser bypasses nginx and may encounter CORS issues.

Verify in `.env`:

- `API_URL` — must be empty (`""`) for the standard production setup
- `ALLOWED_ORIGIN` — must exactly match the URL users type into their browser to reach the frontend (same scheme, host, and port)

After updating `.env`, restart the stack for the changes to take effect:

```sh
docker compose down && docker compose up -d
```
