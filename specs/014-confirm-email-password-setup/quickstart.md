# Quickstart: Confirm Email → Password Setup Redirect

**Feature**: `014-confirm-email-password-setup`
**Date**: 2026-03-18

## Run Backend Tests

```bash
cd backend
dotnet test
```

Target the new integration test specifically:

```bash
cd backend
dotnet test --filter "ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken"
```

## Run Frontend Tests

```bash
cd frontend
npm test
```

Target the confirm-email tests specifically:

```bash
cd frontend
npx vitest run tests/confirm-email.test.ts --reporter=verbose
```

## Manual End-to-End Test

Requires the full stack running:

```bash
docker compose up --build
```

1. Log in as admin and create a new user (no password needed for admin-created accounts)
2. Check MailHog (`http://localhost:8025`) for the confirmation email
3. Click the confirmation link — should redirect to `http://localhost:3000/confirm-email.html?token=...`
4. The confirmation page shows a loading spinner, then redirects to `/reset-complete.html?token=...`
5. Set a password on the reset-complete page
6. Log in with the new credentials — should succeed

## Verify Regression

1. Use an expired or invalid confirmation token → confirmation page shows error panel, no redirect
2. Visit confirmation page with no token → immediate error, no network request
3. Use a confirmation token twice → second use returns 400, error panel shown

## Key Files

| File | Change |
|------|--------|
| `backend/WeightTracker.Domain/Interfaces/Services/IEmailConfirmationService.cs` | `ConfirmAsync` return type |
| `backend/WeightTracker.Domain/Interfaces/Services/IPasswordResetService.cs` | New `CreateResetTokenAsync` method |
| `backend/WeightTracker.Infrastructure/Services/EmailConfirmationService.cs` | `ConfirmAsync` implementation |
| `backend/WeightTracker.Infrastructure/Services/PasswordResetService.cs` | `CreateResetTokenAsync` implementation |
| `backend/WeightTracker.Api/Endpoints/AuthEndpoints.cs` | confirm-email handler |
| `backend/WeightTracker.Tests/Integration/Endpoints/EmailConfirmationEndpointsTests.cs` | New test (written first) |
| `frontend/src/ts/api-client.ts` | `confirmEmail` return type |
| `frontend/src/ts/confirm-email.ts` | Success path → redirect |
| `frontend/tests/confirm-email.test.ts` | Update success tests (updated first) |
