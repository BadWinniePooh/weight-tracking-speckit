# Quickstart: Admin & User Management with Email Infrastructure

**Feature**: 007-admin-user-management
**Date**: 2026-03-15

---

## New Environment Variables

Add the following to your `.env` (and `docker-compose.yml` backend service):

```env
# SMTP configuration (required — any RFC-compliant SMTP server)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_SENDER_EMAIL=no-reply@yourdomain.com

# Base URL used to build reset and confirmation links in emails
APP_BASE_URL=https://your-app-domain.com

# Grace period (days) before deactivated users are permanently deleted
USER_DELETION_GRACE_DAYS=30
```

**Local development with MailHog** (SMTP stub):

```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

Then set:
```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_SENDER_EMAIL=dev@localhost
APP_BASE_URL=http://localhost:3000
```

MailHog web UI is available at `http://localhost:8025` — all outbound emails appear there instead of being delivered.

---

## Running Tests

Tests require Docker (for Testcontainers PostgreSQL + MailHog containers).

```bash
cd backend
dotnet test
```

The `ApiFixture` spins up a PostgreSQL container and a MailHog container automatically. No manual setup needed.

---

## Running the Full Stack

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with real values or MailHog settings

docker compose up --build
```

The backend runs database migrations automatically on startup.

---

## Email Link Templates

The backend constructs email links as follows:

| Flow | URL Pattern |
|------|-------------|
| Password reset | `{APP_BASE_URL}/reset-password.html?token={token}` |
| Email confirmation | `{APP_BASE_URL}/confirm-email.html?token={token}` |

These pages are deferred to the next iteration (008). The links will 404 until those pages are built.

---

## Admin Policy

The `AdminOnly` authorization policy checks for a `role: admin` JWT claim. The claim is issued at login by `JwtTokenService`. Endpoints using this policy return `403 Forbidden` for authenticated non-admin users.

---

## Background Service

`UserDeletionHostedService` runs:
1. Once on application startup
2. Every 24 hours thereafter

To test deletion behaviour in development, temporarily set `USER_DELETION_GRACE_DAYS=0` to schedule all deactivated users for immediate cleanup on the next run.

---

## Security Notes

- All token values stored in the database are SHA-256 hashes; plaintext tokens only exist in emails and the request body at the time of use
- Password reset tokens expire in **1 hour**
- Email confirmation tokens expire in **24 hours**
- Admins cannot deactivate, delete, or change the role of their own account (enforced at the service layer)
- The audit log cannot be modified or deleted via the application (interface design enforces append-only)
- For production: consider revoking `DELETE` and `UPDATE` on the `AuditLog` database table at the PostgreSQL role level
