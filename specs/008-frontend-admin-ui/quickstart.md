# Quickstart: Frontend Admin UI and User-Facing Pages

**Feature**: 008-frontend-admin-ui
**Date**: 2026-03-16

---

## No New Environment Variables

This iteration adds no new environment variables. All configuration is inherited from the existing stack (iteration 007).

---

## No New Docker Services

No new containers or Docker Compose changes. The existing three-service stack (`db`, `backend`, `frontend`) is unchanged.

---

## Running the Frontend

```bash
# From the frontend/ directory
cd frontend

# Install dependencies (if not already done)
npm install

# Run all tests (Vitest)
npm test

# Run tests in watch mode
npm run test:watch

# Build for production (outputs to frontend/dist/)
npm run build

# Dev server (hot reload, proxies API calls)
npm run dev
```

---

## Testing the New Pages Locally

After `npm run dev` or after building and serving with Docker:

| Page | URL | Access requirement |
|------|-----|-------------------|
| Password Reset Request | `/reset-request.html` | None (public) |
| Password Reset Complete | `/reset-complete.html?token=<token>` | None (public — token from email) |
| User Profile | `/profile.html` | Must be logged in |
| Admin Dashboard | `/admin.html` | Must be logged in as admin |

**Getting a reset token for local testing**:
If running with MailHog (from iteration 007 setup), navigate to `http://localhost:8025` after submitting a reset request to retrieve the email and copy the token from the link.

---

## Backend Amendment Verification

After implementing the `actorUsername`/`targetUsername` audit log change:

```bash
# From the backend/ directory
cd backend

# Run integration tests (requires Docker for Testcontainers)
dotnet test --filter "AuditLog"
```

The amended `AuditLogEndpointsTests` should include assertions that:
- `actorUsername` is a non-null, non-empty string in every audit log entry
- `targetUsername` is `null` for entries with no target user

---

## Build Verification

After adding the new Vite entry points, verify all pages are included in the production build:

```bash
cd frontend
npm run build
ls dist/  # Should include reset-request, reset-complete, profile, admin HTML files
```
