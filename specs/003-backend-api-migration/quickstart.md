# Quickstart Guide: Backend API Migration (003)

**Date**: 2026-03-14

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker Desktop (or Engine + Compose V2) | 4.x+ | Running all three containers |
| Node.js + npm | 20+ | Frontend development only |
| .NET SDK | 8.0 | Backend development only |
| Git | any | Branch checkout |

---

## Running with Docker Compose (Recommended)

This is the primary deployment path and the one that satisfies all acceptance scenarios.

**1. Check out the feature branch**

```bash
git checkout 003-backend-api-migration
```

**2. Create a `.env` file at the repository root**

```env
# Frontend — URL the browser uses to reach the API
API_URL=http://localhost:8080

# Backend — Origin the API allows for CORS
ALLOWED_ORIGIN=http://localhost:3000

# Database credentials
POSTGRES_USER=weighttracker
POSTGRES_PASSWORD=changeme_local
POSTGRES_DB=weighttracker
```

> **Security note**: Never commit `.env` to version control. Use a strong password in any network-accessible deployment.

**3. Start the stack**

```bash
docker-compose up
```

Containers start in dependency order: **database → backend → frontend**. On first run the database initialises, migrations run, and the default user and chart settings are seeded. Allow ~20–30 seconds for all three containers to reach healthy status.

**4. Open the app**

Navigate to [http://localhost:3000](http://localhost:3000).

**5. Shut down**

```bash
docker-compose down          # stops containers, preserves data volume
docker-compose down -v       # stops containers AND deletes the data volume
```

---

## Environment Variables Reference

### Frontend container

| Variable | Required | Description |
|----------|----------|-------------|
| `API_URL` | Yes | Base URL the browser uses to reach the backend API. Must be reachable from the user's browser (not the Docker network name). |

### Backend container

| Variable | Required | Description |
|----------|----------|-------------|
| `ALLOWED_ORIGIN` | Yes | Frontend origin permitted for CORS (e.g., `http://localhost:3000`). No wildcard. |
| `ConnectionStrings__DefaultConnection` | Yes | PostgreSQL connection string. Set automatically by docker-compose from the `POSTGRES_*` vars. |

### Database container

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | Yes | — | Database username |
| `POSTGRES_PASSWORD` | Yes | — | Database password |
| `POSTGRES_DB` | Yes | — | Database name |

---

## Frontend Development (without Docker)

Use this workflow when iterating on the TypeScript frontend while the backend runs separately.

**1. Install dependencies**

```bash
npm install
```

**2. Provide a runtime config pointing at the local backend**

```bash
echo '{ "apiUrl": "http://localhost:8080" }' > public/config.json
```

**3. Start the dev server**

```bash
npm run dev
```

The frontend is served at `http://localhost:5173` by default. Vite's dev server proxies the `/config.json` request to the `public/` directory.

**4. Run frontend tests**

```bash
npm test
```

---

## Backend Development (without Docker)

Use this workflow when iterating on the C# API while the frontend runs separately.

**1. Start a PostgreSQL instance**

Start just the database container (no full stack required):

```bash
docker-compose up db
```

Or use any local PostgreSQL 16+ instance.

**2. Set environment variables**

```bash
export ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=weighttracker;Username=weighttracker;Password=changeme_local"
export AllowedOrigin="http://localhost:5173"
```

**3. Run the backend**

```bash
cd backend/WeightTracker.Api
dotnet run
```

The API starts at `http://localhost:8080`. Database migrations and seeding run automatically on startup.

**4. Run backend tests**

```bash
cd backend
dotnet test
```

---

## Data Migration (Existing Users)

If you have weight data from an earlier version of the app stored in your browser's localStorage:

1. Open the app in the same browser that holds your old data.
2. The **"Import from previous version"** button is visible in the app (shown when localStorage data is detected).
3. Click the button and confirm. The tool reports how many entries were migrated and lists any that were skipped.
4. After a successful migration, the button disappears and all your historical data appears in the history list.

The migration is safe to re-run — duplicate entries are silently skipped.

---

## Verifying the Stack

After `docker-compose up`, confirm all layers are working:

```bash
# Check all three containers are healthy
docker-compose ps

# Check the backend health endpoint directly
curl http://localhost:8080/health

# Expected response:
# {"status":"Healthy","checks":{"database":"Healthy"}}
```

---

## Security Notes

- The API has **no authentication** in this iteration. Do not expose port 8080 to the public internet.
- Restrict backend port 8080 at your firewall or reverse proxy — only the frontend container needs access.
- Use HTTPS via a reverse proxy (nginx, Caddy, or Traefik) in any network-accessible deployment. The constitution requires HTTPS at the deployment layer.
- The database port (5432) is not published to the host by default; it is only accessible within the Docker network.
