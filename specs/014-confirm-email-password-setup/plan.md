# Implementation Plan: Confirm Email → Password Setup Redirect

**Branch**: `014-confirm-email-password-setup` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)

## Summary

When a new user confirms their email, the confirmation endpoint now generates a password reset token and includes it in the 200 response. The confirmation page reads this token from the response and redirects to `/reset-complete.html?token=<passwordResetToken>` instead of showing a static success panel. The existing password reset page handles the full password setup flow from there. Changes are limited to three backend files (two interfaces, two services, one endpoint) and two frontend files (api-client, confirm-email page module). TDD is mandatory for both stacks: backend integration test and frontend tests are written and confirmed failing before any implementation.

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend); TypeScript 5.x ES2020 (frontend)
**Primary Dependencies**: ASP.NET Core Minimal API, EF Core 8 + Npgsql (backend); Vite 5.x, Vitest 2.x + jsdom (frontend)
**Storage**: PostgreSQL 16 — no schema changes; `PasswordResetTokens` table is written to via existing infrastructure
**Testing**: xUnit + Testcontainers.PostgreSql (backend integration); Vitest 2.x + jsdom (frontend unit)
**Target Platform**: Docker Compose stack (Linux container); browser (frontend)
**Project Type**: Web application — full-stack amendment
**Performance Goals**: No change; token generation is already used in the password reset flow
**Constraints**: No new token types, no new service classes, no new pages, no schema migrations; backend change is one endpoint amendment only
**Scale/Scope**: 5 backend files amended + 1 new test; 2 frontend files amended + 1 existing test file updated

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | spec.md complete and validated before planning |
| II. Privacy & Data Ownership | ✅ PASS | Password reset token is single-use, 1-hour expiry; returned over TLS; never stored in plaintext |
| III. Test-First (TDD) | ✅ PASS | Backend integration test written first; frontend tests updated and confirmed failing before implementation |
| IV. Incremental Delivery (MVP First) | ✅ PASS | US1 (success redirect) and US2 (error regression) are the only stories; both are independently testable; US1 is the MVP |
| V. Simplicity (YAGNI) | ✅ PASS | No new service, no new token type, no new pages; smallest change to existing interfaces |

**Post-design re-check**: All gates remain green. Complexity Tracking section is empty — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/014-confirm-email-password-setup/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-contract.md  # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (amended files only)

```text
backend/
  WeightTracker.Domain/Interfaces/Services/
    IEmailConfirmationService.cs        AMEND: ConfirmAsync return type bool → Guid?
    IPasswordResetService.cs            AMEND: add CreateResetTokenAsync(Guid) method
  WeightTracker.Infrastructure/Services/
    EmailConfirmationService.cs         AMEND: ConfirmAsync returns userId on success
    PasswordResetService.cs             AMEND: implement CreateResetTokenAsync
  WeightTracker.Api/Endpoints/
    AuthEndpoints.cs                    AMEND: confirm-email handler uses new types
  WeightTracker.Tests/Integration/Endpoints/
    EmailConfirmationEndpointsTests.cs  AMEND: add new test (TDD — written first)

frontend/
  src/ts/
    api-client.ts                       AMEND: confirmEmail return type + interface
    confirm-email.ts                    AMEND: success path redirects instead of shows panel
  tests/
    confirm-email.test.ts               AMEND: update success tests (TDD — updated first)
```

**Structure Decision**: Full-stack web application. Backend uses Ports and Adapters (Domain interfaces → Infrastructure implementations → Api endpoint). Frontend uses the existing page module + api-client pattern.

## Implementation Phases

### Phase 0: Backend TDD — Write Failing Test

**Mandatory first step for backend changes.**

1. Add test `ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken` to `EmailConfirmationEndpointsTests.cs`:
   - Creates an unconfirmed user, sends confirmation email, extracts token
   - Calls `GET /api/auth/confirm-email?token=<token>`
   - Asserts `HttpStatusCode.OK`
   - Deserialises response body and asserts `passwordResetToken` field is non-null and non-empty
2. Run `cd backend && dotnet test --filter "ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken"` and confirm the test **FAILS** (expected: property not found on response — 404 on JsonElement access, or assertion failure)

### Phase 1: Frontend TDD — Update Failing Tests

**Mandatory first step for frontend changes.**

1. In `confirm-email.test.ts`:
   - Update the `confirmEmail` mock in `beforeEach` from `mockResolvedValue(undefined)` to `mockResolvedValue({ message: "Email confirmed.", passwordResetToken: "test-reset-token" })`
   - Update test 5 (`shows success-panel...`): remove the success-panel assertions; instead assert `window.location.href === "/reset-complete.html?token=test-reset-token"` (add `window.location` mock like `reset-complete.test.ts`)
   - Update test 6 (`success-panel contains a link...`): repurpose to assert `window.location.href` starts with `/reset-complete.html?token=` after a successful confirmation
2. Run `cd frontend && npx vitest run tests/confirm-email.test.ts --reporter=verbose` and confirm tests 5 and 6 **FAIL** (old implementation shows success panel, does not redirect)

### Phase 2: Backend Implementation

**Prerequisites**: Phase 0 test confirmed failing.

**Step 1** — `IEmailConfirmationService.cs`: change `Task<bool> ConfirmAsync(string token)` to `Task<Guid?> ConfirmAsync(string token)`

**Step 2** — `IPasswordResetService.cs`: add `Task<string> CreateResetTokenAsync(Guid userId)` to the interface

**Step 3** — `EmailConfirmationService.cs`: update `ConfirmAsync` to return `user.Id` instead of `true`, and `null` instead of `false`

**Step 4** — `PasswordResetService.cs`: implement `CreateResetTokenAsync(Guid userId)`:
```csharp
public async Task<string> CreateResetTokenAsync(Guid userId)
{
    var bytes = RandomNumberGenerator.GetBytes(32);
    var plaintext = Base64UrlEncode(bytes);
    var hash = HashToken(plaintext);
    await tokenRepository.CreateAsync(new PasswordResetToken
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        TokenHash = hash,
        ExpiresAt = DateTime.UtcNow.AddHours(TokenExpiryHours),
        CreatedAt = DateTime.UtcNow
    });
    return plaintext;
}
```

**Step 5** — `AuthEndpoints.cs`: update the confirm-email handler:
```csharp
app.MapGet("/api/auth/confirm-email", async (
    string token,
    IEmailConfirmationService emailConfirmationService,
    IPasswordResetService passwordResetService) =>
{
    var confirmedUserId = await emailConfirmationService.ConfirmAsync(token);
    if (confirmedUserId is null)
        return Results.Json(new { error = "This confirmation link is invalid or has expired." }, statusCode: 400);

    var resetToken = await passwordResetService.CreateResetTokenAsync(confirmedUserId.Value);
    return Results.Ok(new { message = "Email confirmed. You may now log in.", passwordResetToken = resetToken });
}).AllowAnonymous();
```

**Step 6** — Run `cd backend && dotnet test` — all tests must pass including the new one.

### Phase 3: Frontend Implementation

**Prerequisites**: Phase 1 tests confirmed failing.

**Step 1** — `api-client.ts`: add `ConfirmEmailResponse` interface and update `confirmEmail`:
```typescript
export interface ConfirmEmailResponse {
  message: string;
  passwordResetToken: string;
}

export async function confirmEmail(token: string): Promise<ConfirmEmailResponse> {
  return request<ConfirmEmailResponse>(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`);
}
```

**Step 2** — `confirm-email.ts`: in the try block after `await confirmEmail(token)`, replace the success-panel logic:
```typescript
// Before:
loadingPanel?.classList.add("hidden");
successPanel?.classList.remove("hidden");

// After:
const { passwordResetToken } = response;
if (!passwordResetToken) {
  // Treat missing token as an error (FR-006)
  loadingPanel?.classList.add("hidden");
  errorPanel?.classList.remove("hidden");
  if (errorMessageEl) errorMessageEl.textContent = "Email confirmed but setup link could not be generated. Please contact support.";
  return;
}
loadingPanel?.classList.add("hidden");
window.location.href = `/reset-complete.html?token=${encodeURIComponent(passwordResetToken)}`;
```

**Step 3** — Run `cd frontend && npm test` — all tests must pass including updated tests 5 and 6.

## Test Plan

### Backend — new test (written in Phase 0)

| Test | Class | Assertion |
|------|-------|-----------|
| `ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken` | `EmailConfirmationEndpointsTests` | 200 OK; body has non-empty `passwordResetToken` field |

### Frontend — updated tests (updated in Phase 1)

| Test # | Old assertion | New assertion |
|--------|--------------|---------------|
| 5 | `#success-panel` not hidden | `window.location.href === "/reset-complete.html?token=test-reset-token"` |
| 6 | `#success-panel` contains `/login.html` link | `window.location.href` starts with `/reset-complete.html?token=` |

All other existing tests (1–4, 7–9) remain unchanged.

## Complexity Tracking

No complexity deviations. The `ConfirmAsync` return type change (`bool` → `Guid?`) is the minimal interface amendment required; the new `CreateResetTokenAsync` method on the existing service is the simplest reuse of existing infrastructure.
