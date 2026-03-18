# Research: Email Confirmation Page

**Feature**: `013-confirm-email-page`
**Date**: 2026-03-18

## Resolved Decisions

---

### Decision 1: API method availability

**Decision**: Use the existing `confirmEmail(token: string): Promise<void>` function in `frontend/src/ts/api-client.ts` (line 188–190). No new API client method is needed.

**Rationale**: The method already exists and calls `GET /api/auth/confirm-email?token=<encoded-token>`. It returns `void` on success and throws `ApiError` on failure — consistent with all other auth methods in the client.

**Alternatives considered**: None needed. The method is already present.

---

### Decision 2: Page type for auth guard

**Decision**: Use `enforceRedirect("public", state)` — the same page type used by `reset-complete.html` and `reset-request.html`.

**Rationale**: The confirmation page must be accessible to unauthenticated users. The `"public"` page type in `auth-guard.ts` allows unauthenticated access. However, authenticated users navigating to a `"public"` page are redirected to the main app (`index.html`) — satisfying FR-009. This is the existing pattern for public-only flows.

**Alternatives considered**: A dedicated `"confirm"` page type was considered but rejected (YAGNI — the existing `"public"` type already implements the required behaviour).

---

### Decision 3: Page state management approach

**Decision**: Implement as a simple auto-executing function on `DOMContentLoaded`, with three statically rendered HTML states (loading, success, error) toggled by hiding/showing elements via the `hidden` CSS class.

**Rationale**: The email confirmation flow is entirely automatic — there is no form submission or user input beyond clicking the link. The page calls the API on load, then transitions to one of two terminal states (success or error). No state machine or reactive framework is needed. This matches the simplest pattern used by existing pages.

**Alternatives considered**: A form-based pattern (like `reset-complete`) was considered but rejected because there is nothing for the user to fill in — the token does all the work.

---

### Decision 4: DOM element strategy

**Decision**: Three content panels controlled by the `hidden` class:
- `#loading-panel` — shown immediately on load (if token present)
- `#success-panel` — shown after a successful API response
- `#error-panel` — shown after a failed API response or when token is absent

**Rationale**: Matches the structure of `reset-complete.html` which uses `#success-panel` with `hidden` toggle. Three distinct panels are cleaner than mutating a single panel's content.

**Alternatives considered**: Single panel with dynamic text injection — rejected because it makes tests harder to assert and violates the existing pattern.

---

### Decision 5: Contact support link destination

**Decision**: Use `mailto:support@example.com` as a placeholder. The spec notes this is acceptable if no dedicated contact page exists.

**Rationale**: No existing contact page was found in the codebase. A `mailto:` link is the simplest compliant option and can be updated later when a real support address is configured.

**Alternatives considered**: Link to a `/contact.html` page — rejected because no such page exists.

---

### Decision 6: No redirect after success

**Decision**: Show the success message and sign-in link permanently — no automatic redirect timer.

**Rationale**: Unlike `reset-complete`, where the user has just set a password and the next step is obvious, email confirmation is often clicked from a mobile email client where an auto-redirect may navigate away from the app unexpectedly. A static link is simpler and gives the user control. The spec says "a link to /login.html" — not "redirect after N seconds".

**Alternatives considered**: Auto-redirect after 3 seconds (like reset-complete) — rejected because the spec does not require it and the user may be on a different device.

---

### Decision 7: Test pattern

**Decision**: Follow the exact pattern of `reset-complete.test.ts`: Vitest + jsdom, `vi.mock` for auth-guard, api-client, config; `setSearch()` helper to override `window.location.search`; `document.body.innerHTML` fixture in `beforeEach`.

**Rationale**: Identical infrastructure, identical pattern, minimal divergence from existing tests.

**Alternatives considered**: None — this is the established project test pattern.
