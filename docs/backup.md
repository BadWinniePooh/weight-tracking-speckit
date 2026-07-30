# Backup & Restore

This document covers all backup and restore procedures for a Weight Tracker instance running via Docker Compose. The database is stored in the Docker named volume `weighttracker-data`. All procedures use standard PostgreSQL tools available inside the `db` container.

> **Before you begin**: Ensure the `db` service is running before executing any backup or restore command. Run `docker compose ps` to confirm it shows `(healthy)` status.

---

## Procedure 1 — Create a Backup

Run the following command from the repository root directory:

```sh
docker compose exec db pg_dump -U ${DB_USER} ${DB_NAME} > backup-$(date +%Y-%m-%d).sql
```

This produces a plain-SQL dump file named `backup-YYYY-MM-DD.sql` in the current directory. The dump contains all table definitions and data rows needed to fully recreate the database from scratch.

**Example output filename**: `backup-2026-03-18.sql`

> **Tip**: Store backup files outside the repository directory (e.g. a dedicated `~/backups/weight-tracker/` folder) and transfer copies off-host regularly. The Docker volume holds the live data; if the host is lost, only off-host backups can restore your data.

---

## Procedure 2 — Verify a Backup

After creating a backup, confirm it is usable before relying on it.

**Quick verification** (inspect the dump file):

```sh
# Check line count — a non-trivial dump has thousands of lines
wc -l backup-YYYY-MM-DD.sql

# Confirm table definitions were captured
grep -c "CREATE TABLE" backup-YYYY-MM-DD.sql

# Check for error indicators from pg_dump
grep -i "error" backup-YYYY-MM-DD.sql
```

A valid dump:
- Contains multiple `CREATE TABLE` statements (one per table in the schema)
- Contains `COPY` or `INSERT` statements with your data rows
- Has no lines beginning with `pg_dump: error` or `pg_dump: warning`

**Full verification** (restore to a throwaway container):

```sh
# Start a temporary PostgreSQL container
docker run --rm -d \
  --name wt-verify \
  -e POSTGRES_DB=verify \
  -e POSTGRES_USER=verify \
  -e POSTGRES_PASSWORD=verify \
  postgres:18-alpine

# Wait a few seconds for it to start, then restore the dump
docker exec -i wt-verify psql -U verify verify < backup-YYYY-MM-DD.sql

# Confirm tables are present
docker exec wt-verify psql -U verify verify -c "\dt"

# Stop and remove the temporary container
docker stop wt-verify
```

Successful output from `\dt` lists all Weight Tracker tables (users, weight_entries, chart_settings, refresh_tokens, etc.).

---

## Procedure 3 — Restore from Backup

> **Warning**: Restore only into an empty database. Restoring into a database that already contains data causes duplicate-key errors. Follow the steps below to clear the database first.

**Step 1 — Stop the backend and frontend** (leave `db` running):

```sh
docker compose stop backend frontend
```

**Step 2 — Clear the existing database**:

```sh
# Drop and recreate the database inside the running db container
docker compose exec db psql -U ${DB_USER} -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker compose exec db psql -U ${DB_USER} -c "CREATE DATABASE ${DB_NAME};"
```

**Step 3 — Restore the dump**:

```sh
docker compose exec -T db psql -U ${DB_USER} ${DB_NAME} < backup-YYYY-MM-DD.sql
```

Replace `backup-YYYY-MM-DD.sql` with the actual filename of your backup.

Successful output shows a sequence of `CREATE TABLE`, `ALTER TABLE`, and `COPY N` lines — one per statement — with no error messages at the end.

**Step 4 — Restart the full stack**:

```sh
docker compose up -d
```

Docker Compose restarts the backend and frontend in dependency order. Verify all services return to `(healthy)` status with `docker compose ps`.
