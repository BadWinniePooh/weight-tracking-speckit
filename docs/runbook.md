# Weight Tracker — Operator Runbook

This runbook covers all operational procedures for a self-hosted Weight Tracker instance running via Docker Compose.

## Table of Contents

1. [Configuration](#configuration)
2. [Authentication Setup](#authentication-setup)
3. [Deploying with Docker Compose](#deploying-with-docker-compose)
4. [Updating to a New Version](#updating-to-a-new-version)
5. [Backing Up the Database](#backing-up-the-database)
6. [Restoring from Backup](#restoring-from-backup)
7. [Rolling Back a Failed Update](#rolling-back-a-failed-update)
8. [Troubleshooting](#troubleshooting)

---

## Configuration

Copy `.env.example` to `.env` at the repository root:

```sh
cp .env.example .env
```

Open `.env` in a text editor and set values for all variables. At minimum, you must set `DB_PASSWORD` to a strong secret — do not leave it as the placeholder value before exposing the app to any network. The `ALLOWED_ORIGIN` value must exactly match the URL users will type into their browser (same scheme, host, and port).

> **Warning**: Running `docker compose up` without a `.env` file, or with empty variable values, will cause startup failures. Docker Compose substitutes undefined variables as empty strings, which results in the database initialising with blank credentials and the backend failing to connect.

---

## Authentication Setup

Weight Tracker uses JWT-based authentication. There are two ways to create the initial admin account.

### Option A — Environment variable seeding (automated deployments)

Set all four variables in `.env` before the first `docker compose up`:

```sh
# Generate a strong random secret (32+ characters required)
openssl rand -base64 32

JWT_SECRET=<output from above>
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong password>
```

On startup, the backend detects that no users exist and automatically creates the admin account using these values. All four variables must be set; if any are missing the seeder logs a warning and skips creation.

> **Note**: After the admin account is created, changing `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` has no effect — the seeder only runs when the `Users` table is empty.

### Option B — First-run setup wizard (interactive)

Leave `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` unset (or empty). You must still set `JWT_SECRET`. After starting the stack, open the frontend in a browser — you will be redirected to `/setup.html` to create the first admin account interactively.

Once any user exists, the setup endpoint returns `409 Conflict` and the setup page is no longer accessible.

### JWT secret requirements

- Must be **at least 32 characters** long.
- Use a cryptographically random value — never a dictionary word or simple phrase.
- Generate one with: `openssl rand -base64 32`
- Changing `JWT_SECRET` after deployment immediately invalidates all existing sessions; all users will need to log in again.

### HTTPS and cookie requirements

The refresh token is stored in an `HttpOnly`, `SameSite=Strict` cookie. In production:

- Serve the frontend over HTTPS — browsers block `SameSite=Strict` cookies on plain HTTP in cross-origin contexts.
- Ensure `ALLOWED_ORIGIN` uses `https://` to match the browser origin exactly.
- Set `COOKIE_SECURE=true` in `.env` if you add that variable to `Program.cs` for explicit Secure cookie enforcement (it is off by default for local dev).

---

## Deploying with Docker Compose

Start all three services in the background:

```sh
docker compose up -d
```

All containers start in dependency order: `db` first, then `backend` once the database is healthy, then `frontend` once the backend is healthy.

Check that all services are running:

```sh
docker compose ps
```

Healthy output shows all three services with `(healthy)` status and their mapped ports.

View live logs for any service:

```sh
docker compose logs -f <service>
```

Replace `<service>` with `db`, `backend`, or `frontend`. Healthy backend startup ends with a line confirming migration and seeding completed.

---

## Updating to a New Version

Pull the latest source code:

```sh
git pull
```

Rebuild images and restart containers without downtime:

```sh
docker compose up --build -d
```

Docker Compose rebuilds only the images that have changed and replaces the running containers. The named volume `weighttracker-data` stores all PostgreSQL data and is completely unaffected by image rebuilds — your data is preserved.

> **Warning**: **Never run `docker compose down -v`** during an update. The `-v` flag destroys all named volumes, permanently deleting your database. Use `docker compose up --build -d` for updates instead.

---

## Backing Up the Database

The database service must be running before taking a backup. Run the following command from the repository root:

```sh
docker compose exec db pg_dump -U ${DB_USER} ${DB_NAME} > backup-$(date +%Y-%m-%d).sql
```

This creates an SQL dump file named `backup-YYYY-MM-DD.sql` in the current directory. The dump contains all table definitions and data rows needed to recreate the database from scratch.

---

## Restoring from Backup

> **Warning**: Restore into an empty database to avoid duplicate-key errors. If the target database already contains data, truncate all tables or drop and recreate the database before restoring.

Run the following command, replacing `backup-YYYY-MM-DD.sql` with the actual filename:

```sh
docker compose exec -T db psql -U ${DB_USER} ${DB_NAME} < backup-YYYY-MM-DD.sql
```

Successful output shows a series of `CREATE TABLE`, `ALTER TABLE`, and `COPY` lines as each statement executes, ending without error messages.

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

## Troubleshooting

### Container won't start

View startup error output:

```sh
docker compose logs backend
docker compose logs db
```

Common causes:

- `.env` file does not exist — create it by running `cp .env.example .env` and filling in all values
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

Verify these two variables in `.env`:

- `API_URL` — must match the host and port the backend is actually reachable at from the browser
- `ALLOWED_ORIGIN` — must exactly match the URL users type into their browser to reach the frontend (same scheme, host, and port)

Check backend logs for CORS-related messages:

```sh
docker compose logs backend
```

After updating `.env`, restart the stack for the changes to take effect:

```sh
docker compose down && docker compose up -d
```
