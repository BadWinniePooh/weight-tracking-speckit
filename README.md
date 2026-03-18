# Weight Tracker

A personal weight tracking web application for self-hosters. Log weight measurements over time, visualize trends with an interactive chart, and monitor progress toward a goal weight. You own your data — everything runs on your own server.

Built for individuals who want a private, no-subscription alternative to cloud fitness apps. Designed to be deployed in under five minutes with Docker Compose.

## Features

- **Weight logging** — record measurements in kg or lbs; edit or delete past entries
- **Trend chart** — interactive Chart.js graph with date-range filtering and a goal-weight line
- **Calorie & macro targets** — configure daily calorie budget and carb/fat ratio from your chart settings
- **Goal tracking** — set a target weight and track projected completion date
- **Admin panel** — manage user accounts, audit logs, and account lifecycle
- **CSV import** — bulk-import historical weight data from a spreadsheet export
- **Self-hosted** — all data stays on your server; no accounts, no telemetry, no subscriptions

## Quick Start

> For production deployments with HTTPS and a custom domain, see the full [Deployment Guide](docs/deployment.md).

**Step 1 — Clone the repository**

```sh
git clone https://github.com/your-username/weight-tracking.git
cd weight-tracking
```

**Step 2 — Configure credentials**

```sh
cp .env.example .env
```

Open `.env` and set at minimum: `DB_PASSWORD`, `JWT_SECRET`, `ALLOWED_ORIGIN`, and `APP_DOMAIN`.

**Step 3 — Start the stack**

```sh
docker compose up -d
```

Requires Docker Engine 20.10+ and Docker Compose v2.0+.

**Step 4 — Open the app**

```
http://localhost:3000
```

**Step 5 — Complete the setup wizard**

On first startup with no existing users, the app redirects to a setup wizard where you create the initial admin account.

## Further Reading

| Document | Contents |
|----------|----------|
| [docs/deployment.md](docs/deployment.md) | Full deployment guide: prerequisites, environment variable reference, Docker Compose startup, Traefik TLS configuration, first-run setup |
| [docs/architecture.md](docs/architecture.md) | System overview, component diagram, technology stack, data model |
| [docs/runbook.md](docs/runbook.md) | Operational procedures: health checks, version upgrades, rollbacks, troubleshooting |
