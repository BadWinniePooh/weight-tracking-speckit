# Weight Tracker

A personal weight tracking web application that lets you log weight measurements over time, visualize trends with an interactive chart, and monitor progress toward a goal weight. Built for self-hosting — you own your data.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose v2.0 or later

## Quick Start

**Step 1 — Clone the repository**

```sh
git clone https://github.com/your-username/weight-tracking.git
cd weight-tracking
```

You now have the source code on your machine.

**Step 2 — Configure credentials**

```sh
cp .env.example .env
```

Open `.env` in a text editor and set all required values — especially `DB_PASSWORD`. Do not leave `DB_PASSWORD` as the placeholder value before exposing the app to any network.

**Step 3 — Start the stack**

```sh
docker compose up -d
```

Open http://localhost:3000 in your browser. The app is running with all data persisted in a local Docker volume.

## Configuration

All configurable variables are defined in `.env.example` at the repository root. Each variable has a one-line comment explaining its purpose and valid values. `.env.example` is the authoritative reference — copy it to `.env` and fill in values for your environment.

## Further Reading

See [docs/runbook.md](docs/runbook.md) for operator guidance on updates, backups, restores, rollbacks, and troubleshooting.
