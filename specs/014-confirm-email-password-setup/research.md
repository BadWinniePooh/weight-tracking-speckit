# Research: Confirm Email → Password Setup Redirect

**Feature**: `014-confirm-email-password-setup`
**Date**: 2026-03-18

## Resolved Decisions

---

### Decision 1: How to generate a password reset token from the confirm-email endpoint

**Decision**: Add a new method `CreateResetTokenAsync(Guid userId): Task<string>` to `IPasswordResetService` / `PasswordResetService`. This method creates and persists a `PasswordResetToken` record using the same generation logic as `RequestResetAsync`, but does **not** send an email and does not look up the user by email — it takes the userId directly and returns the plaintext token.

**Rationale**: The existing `RequestResetAsync(email)` sends an email as a side effect. That is not appropriate here — the token is returned in the API response, not emailed. Extracting the token-creation concern into a dedicated method on the existing service is the minimal change that reuses the existing infrastructure (same repo, same token format, same expiry, same table) without any new service class. The method stays within the existing service boundary.

**Alternatives considered**:
- Duplicate token generation inline in the endpoint — rejected (violates DRY; business logic in endpoint handler)
- New `PasswordSetupTokenService` — rejected (new service class prohibited by spec and YAGNI)
- Call `RequestResetAsync` and intercept the email — rejected (impossible without significant infrastructure change)

---

### Decision 2: How to return the userId from `ConfirmAsync` to the endpoint

**Decision**: Change `IEmailConfirmationService.ConfirmAsync(string token): Task<bool>` to return `Task<Guid?>`. Returns the confirmed user's `Id` on success, `null` on failure. The endpoint checks for null (→ 400) or a non-null Guid (→ call `CreateResetTokenAsync`, return 200 with token).

**Rationale**: The endpoint needs the userId to generate the reset token. `ConfirmAsync` already resolves the userId internally (from the stored token) and has access to it at the point where it currently returns `true`. Returning it instead of `true` is a minimal, non-breaking change to the service. The only callers of `ConfirmAsync` are the endpoint and the integration test — both are updated as part of this feature.

**Alternatives considered**:
- Add a separate `GetUserIdForTokenAsync` lookup before calling `ConfirmAsync` — rejected (two DB reads instead of one; token is consumed on first read)
- Return a richer `EmailConfirmationResult` object — rejected (over-engineering for a boolean + Guid; YAGNI)
- Keep return type as `bool` and look up user by username/email in the endpoint — rejected (no mechanism to correlate the confirmation token with the user at the endpoint layer without another DB call)

---

### Decision 3: Token expiry for the password setup token

**Decision**: Use the same 1-hour expiry as standard password reset tokens (`TokenExpiryHours = 1` in `PasswordResetService`).

**Rationale**: The `CreateResetTokenAsync` method will be implemented inside `PasswordResetService` and will use the same `TokenExpiryHours` constant. No separate configuration. Consistent with spec FR-003 ("same structure and expiry rules").

**Alternatives considered**: Longer expiry (24h) — rejected (no security justification; the user has just confirmed their email and should set their password immediately).

---

### Decision 4: Existing test `ConfirmEmail_ValidToken_SetsConfirmedAndLoginSucceeds`

**Decision**: The existing test asserts `body.GetProperty("message").GetString()` equals the exact string `"Email confirmed. You may now log in."`. The new endpoint adds `passwordResetToken` to the response but does NOT change the `message` field, so this assertion continues to pass. No update to this test is needed. A new separate test (`ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken`) is added alongside it.

**Rationale**: The spec says "alongside the existing confirmation message" (FR-002). Keeping the message text unchanged avoids breaking existing API clients and the existing test.

**Alternatives considered**: Update the message text to indicate password setup — rejected (unnecessary, the redirect handles the UX; changing the message breaks the existing test for no user-facing benefit).

---

### Decision 5: Frontend — `confirmEmail` API client return type

**Decision**: Change `confirmEmail(token: string): Promise<void>` to `confirmEmail(token: string): Promise<ConfirmEmailResponse>` where `ConfirmEmailResponse = { message: string; passwordResetToken: string }`. Update the `request<void>` call to `request<ConfirmEmailResponse>`.

**Rationale**: The frontend needs access to the `passwordResetToken` field in the response to perform the redirect. This requires the return type to be updated from `void` to a typed response object. The change is localised to one function in `api-client.ts`.

**Alternatives considered**: Parse the raw response body in `confirm-email.ts` directly — rejected (all other API responses are typed at the api-client layer; inconsistent pattern).

---

### Decision 6: Frontend TDD — which tests to update

**Decision**: In `confirm-email.test.ts`, two tests target the success path and must be updated before implementation:

- **Test 5** (`shows success-panel and hides loading-panel after successful confirmation`) → updated to assert `window.location.href === "/reset-complete.html?token=test-reset-token"` (using the mock confirmEmail resolved value that includes a `passwordResetToken`)
- **Test 6** (`success-panel contains a link to /login.html`) → updated to assert `window.location.href` starts with `/reset-complete.html?token=` (or removed/repurposed — this test becomes redundant once the redirect replaces the success panel)

The `confirmEmail` mock in `beforeEach` is updated from `mockResolvedValue(undefined)` to `mockResolvedValue({ message: "Email confirmed.", passwordResetToken: "test-reset-token" })`. The `window.location.href` spy pattern from `reset-complete.test.ts` is used for the redirect assertion.

**Rationale**: Per the user's explicit instruction and the TDD constitution requirement: tests must be updated to assert the new (currently-not-implemented) behaviour and confirmed failing before implementation.

**Alternatives considered**: Add new tests rather than updating existing ones — rejected (the existing tests assert the old behaviour which must no longer occur; leaving them would allow them to pass on the old code and fail on new code in the wrong direction).

---

### Decision 7: The confirm-email.html success panel

**Decision**: Since the success path now redirects immediately, the `#success-panel` in `confirm-email.html` is no longer reachable. It should be kept in the HTML for now (no change to the HTML file) — the redirect happens before it would ever be shown. Removing it is a polish concern beyond the scope of this feature.

**Rationale**: The spec explicitly states "No new pages. No new UI components. No changes to the reset-complete page itself." The HTML of `confirm-email.html` is not mentioned. Keeping the success panel dormant is simpler than removing it and avoids scope creep.

**Alternatives considered**: Remove `#success-panel` from `confirm-email.html` — rejected (beyond stated scope; the panel causes no harm dormant).

---

### Decision 8: Backend TDD — test placement

**Decision**: The new integration test `ConfirmEmail_ValidToken_ResponseIncludesPasswordResetToken` is added to the existing `EmailConfirmationEndpointsTests.cs` class. It uses the same helper pattern (`CreateUnconfirmedUserAsync`, `SendConfirmationAsync`, `ExtractTokenFromEmailBody`) already present in the file.

**Rationale**: Co-locating with existing email confirmation tests maintains consistency and avoids a new test class for a single test method.
