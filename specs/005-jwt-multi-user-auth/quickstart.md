# Quickstart: Multi-User Support and Authentication

**Feature**: 005-jwt-multi-user-auth
**Date**: 2026-03-14

---

## New Environment Variables

This feature adds the following environment variables to `docker-compose.yml` (backend service).

### Required for JWT (must always be set)

| Variable | Example | Notes |
|----------|---------|-------|
| `JWT_SECRET` | `change-me-32-chars-minimum!!` | Signing key; minimum 32 characters; generate with `openssl rand -base64 32` |
| `JWT_ISSUER` | `https://weighttracker.example.com` | Token issuer claim |
| `JWT_AUDIENCE` | `https://weighttracker.example.com` | Token audience claim |

### Optional — admin bootstrap (all three required together, or none)

| Variable | Example | Notes |
|----------|---------|-------|
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_EMAIL` | `admin@example.com` | Initial admin email |
| `ADMIN_PASSWORD` | `s3cur3P4ss!` | Initial admin password (min 8 chars) |

If all three are present at startup and no matching admin exists, the account is created automatically. If only some are present, the app logs a warning and enters first-run mode.

### Optional — SMTP (all five required together for password reset to work)

| Variable | Example | Notes |
|----------|---------|-------|
| `SMTP_HOST` | `smtp.mailhog.local` | SMTP server hostname |
| `SMTP_PORT` | `1025` | SMTP port (25, 465, or 587 are common) |
| `SMTP_USER` | `user@example.com` | SMTP authentication username |
| `SMTP_PASSWORD` | `smtppassword` | SMTP authentication password |
| `SMTP_SENDER_EMAIL` | `noreply@weighttracker.example.com` | From address on reset emails |

If SMTP is not configured, `/api/auth/forgot-password` returns HTTP 503 and the frontend hides the "Forgot password?" link.

---

## docker-compose.yml additions (backend service)

```yaml
environment:
  # ... existing DB_* and AllowedOrigin vars ...

  # JWT (required)
  JWT_SECRET: "${JWT_SECRET}"
  JWT_ISSUER: "${JWT_ISSUER}"
  JWT_AUDIENCE: "${JWT_AUDIENCE}"

  # Admin bootstrap (optional)
  ADMIN_USERNAME: "${ADMIN_USERNAME:-}"
  ADMIN_EMAIL: "${ADMIN_EMAIL:-}"
  ADMIN_PASSWORD: "${ADMIN_PASSWORD:-}"

  # SMTP (optional)
  SMTP_HOST: "${SMTP_HOST:-}"
  SMTP_PORT: "${SMTP_PORT:-}"
  SMTP_USER: "${SMTP_USER:-}"
  SMTP_PASSWORD: "${SMTP_PASSWORD:-}"
  SMTP_SENDER_EMAIL: "${SMTP_SENDER_EMAIL:-}"
```

Create a `.env` file in the repo root (gitignored) with your actual values.

---

## First-Run Flow

**Scenario A — env vars set**: Set all three `ADMIN_*` vars, start the stack. The admin account is ready automatically; navigate to the app, log in.

**Scenario B — no env vars (first-run wizard)**:

1. Start the stack without `ADMIN_*` vars.
2. Open the app — the first-run wizard loads automatically.
3. Enter username, email, and password for the admin account.
4. Submit — you are logged in as admin.
5. The wizard is permanently disabled from this point.

---

## Local Development with MailHog (SMTP testing)

Add MailHog to `docker-compose.yml` for local email testing:

```yaml
mailhog:
  image: mailhog/mailhog
  ports:
    - "8025:8025"   # Web UI
    - "1025:1025"   # SMTP
```

Set SMTP env vars:
```
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_SENDER_EMAIL=noreply@localhost
```

Password reset emails are captured at `http://localhost:8025`.

---

## Database Migration

This feature includes a new EF Core migration that:
- Adds `Username`, `Email`, `PasswordHash`, `Role`, `IsActive` columns to `Users`
- Drops the `DisplayName` column
- Creates the `RefreshTokens` table
- Creates the `PasswordResetTokens` table
- Removes the stub default user seed (row `00000000-0000-0000-0000-000000000001`)

The migration runs automatically at startup (same retry loop as spec 003). **Backup your data before applying to a production instance.**

---

## CORS Update

The backend `CORS` policy already restricts to `AllowedOrigin`. This feature adds:
- `AllowCredentials()` — required for the browser to send httpOnly cookies cross-origin.
- The frontend must send `credentials: 'include'` on all auth-related requests.

Update `docker-compose.yml` to ensure `AllowedOrigin` matches the exact origin of the frontend (protocol + host + port, no trailing slash).
