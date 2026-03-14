# Weight Tracker — Operator Runbook

## Initial Configuration

Copy `.env.example` to `.env` and set values for your environment:

```sh
cp .env.example .env
```

### `ALLOWED_ORIGIN` — Required

This is the single most important variable to set correctly. The backend
uses it as the CORS allowed origin, so it must exactly match the URL
that users will type into their browser to reach the app — same scheme,
host, and port.

| Access scenario | `ALLOWED_ORIGIN` value |
|---|---|
| Local machine only | `http://localhost:3030` |
| LAN access by IP | `http://192.168.1.100:3030` |
| LAN access by hostname | `http://myserver.local:3030` |

If this is wrong, the browser will block all API requests with a CORS error.
The fix is always the same: update `.env`, then restart the stack:

```sh
docker compose down && docker compose up -d
```

---

## Deploying with Docker Compose

```sh
cp .env.example .env          # first time only — edit ALLOWED_ORIGIN
docker compose up -d --build
```

Containers start in dependency order: `db` → `backend` → `frontend`.
The app is reachable at the URL you set in `ALLOWED_ORIGIN`.

---

## Updating to a New Version Without Data Loss

```sh
git pull
docker compose up -d --build
```

The PostgreSQL data lives in the `weighttracker-data` named volume and
is not touched by a rebuild.

---

## Backing Up the PostgreSQL Volume

```sh
docker compose exec db pg_dump -U weighttracker weighttracker \
  > backup-$(date +%Y%m%d).sql
```

---

## Restoring from Backup

```sh
docker compose exec -T db psql -U weighttracker weighttracker \
  < backup-20260314.sql
```

---

## Rolling Back a Failed Update

```sh
git checkout <previous-tag-or-commit>
docker compose up -d --build
```

Data is preserved in the volume; only the application images are rebuilt.

---

## Troubleshooting

### Container won't start

```sh
docker compose logs backend
docker compose logs db
```

Common causes: `ALLOWED_ORIGIN` not set in `.env`, or DB not yet healthy
when the backend tried to connect (the backend retries 30 times — wait
30 s and check again).

### DB connection errors

Verify the connection string in `docker-compose.yml` matches the
credentials in the `db` service environment block.

### Frontend can't reach backend (CORS error)

The browser console will show: `Access-Control-Allow-Origin header missing`.

Check that `ALLOWED_ORIGIN` in `.env` exactly matches the URL in the
browser address bar (scheme + host + port). After changing `.env`:

```sh
docker compose down && docker compose up -d
```
