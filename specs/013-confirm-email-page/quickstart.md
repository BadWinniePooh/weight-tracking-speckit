# Quickstart: Email Confirmation Page

**Feature**: `013-confirm-email-page`
**Date**: 2026-03-18

## Prerequisites

- Node.js 20+ and npm
- Docker + Docker Compose (for full-stack testing)
- Existing weight-tracker dev environment running

## Run Frontend Dev Server

```bash
cd frontend
npm install   # first time only
npm run dev
```

The page will be available at: `http://localhost:5173/confirm-email.html`

## Test the Page Manually

**Valid token flow** (requires a running backend with a seeded token):
```
http://localhost:5173/confirm-email.html?token=<valid-token>
```
Expected: Loading spinner → success message with "Sign In" link.

**Missing token flow**:
```
http://localhost:5173/confirm-email.html
```
Expected: Immediate error message (no spinner), "Back to Sign In" link.

**Invalid token flow**:
```
http://localhost:5173/confirm-email.html?token=invalid-fake-token
```
Expected: Loading spinner → error message with "Back to Sign In" and "Contact Support" links.

## Run Frontend Tests

```bash
cd frontend
npm test
```

The confirm-email test file is at `frontend/tests/confirm-email.test.ts`.

To run only this feature's tests:
```bash
cd frontend
npx vitest run tests/confirm-email.test.ts
```

## Build for Production

```bash
cd frontend
npm run build
```

`confirm-email.html` is registered as a build entry point in `vite.config.ts` under key `confirmEmail`.

## Full Stack (Docker Compose)

```bash
docker compose up --build
```

The confirmation page is served by nginx at `/confirm-email.html`. The backend `/api/auth/confirm-email` endpoint is already implemented and requires no changes.
