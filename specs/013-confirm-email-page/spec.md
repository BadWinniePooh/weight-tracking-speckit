# Feature Specification: Email Confirmation Page

**Feature Branch**: `013-confirm-email-page`
**Created**: 2026-03-18
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New User Confirms Email (Priority: P1)

A newly created user clicks the confirmation link in the email they received after an admin created their account. They are taken to the confirmation page, which automatically processes their token and shows a success message with a link to sign in.

**Why this priority**: This is the core purpose of the page — without it, newly created users cannot complete account setup and gain access to the application.

**Independent Test**: Can be fully tested by navigating to the confirmation page with a valid token in the URL and verifying the success state renders with a sign-in link.

**Acceptance Scenarios**:

1. **Given** a new user with a valid confirmation token, **When** they navigate to the confirmation page with `?token=<valid-token>` in the URL, **Then** a loading indicator is shown while the request is in flight
2. **Given** a new user with a valid confirmation token, **When** the confirmation request completes successfully, **Then** the loading indicator is replaced by a success message reading "Your email has been confirmed. You can now sign in." and a link to the sign-in page is visible
3. **Given** the success state is displayed, **When** the user clicks the sign-in link, **Then** they are taken to the login page

---

### User Story 2 - Invalid or Expired Token (Priority: P2)

A user navigates to the confirmation page with a token that is invalid or has already expired. The page shows a clear error message and offers the user a path to either contact support or return to the login page.

**Why this priority**: Graceful error handling is essential for user trust; token expiry is a common and expected scenario that must be handled clearly.

**Independent Test**: Can be fully tested by navigating to the confirmation page with an invalid or expired token and verifying the error state renders with actionable recovery links.

**Acceptance Scenarios**:

1. **Given** a user with an invalid or expired token, **When** they navigate to the confirmation page, **Then** the confirmation request is made and the loading state is shown
2. **Given** the confirmation request returns a failure, **When** the response is received, **Then** an error message is displayed explaining the link is invalid or has expired
3. **Given** the error state is displayed, **When** the user views the page, **Then** a link to return to the login page and a link to contact support are both visible

---

### User Story 3 - Missing Token in URL (Priority: P3)

A user navigates to the confirmation page with no token in the URL — for example, by following a truncated or malformed link. The page shows an error immediately, without making any network request.

**Why this priority**: Missing tokens are a distinct failure mode from invalid ones and should be handled without an unnecessary server round-trip.

**Independent Test**: Can be fully tested by navigating to the confirmation page with no query string and verifying the error state appears immediately with no network request made.

**Acceptance Scenarios**:

1. **Given** a user navigates to the confirmation page with no `?token=` parameter in the URL, **When** the page loads, **Then** an error message is shown immediately without any loading state or network request
2. **Given** the missing-token error state is displayed, **When** the user views the page, **Then** a link to return to the login page is visible

---

### User Story 4 - Authenticated User Redirect (Priority: P4)

An already-authenticated user navigates to the confirmation page (e.g., by clicking an old link). They are immediately redirected to the main application without seeing the confirmation page.

**Why this priority**: Consistent with the behaviour of other public-only pages in the app (e.g., reset-complete.html); prevents confusion for authenticated users.

**Independent Test**: Can be fully tested by loading the confirmation page with an active authenticated session and verifying an immediate redirect to the main app occurs.

**Acceptance Scenarios**:

1. **Given** a user with an active authenticated session, **When** they navigate to the confirmation page, **Then** they are immediately redirected to the main application page

---

### Edge Cases

- What happens if the user has already confirmed their email and clicks the link again? (The backend returns a failure response; the page displays the invalid/expired token error state)
- What happens if the confirmation request times out or the server is unreachable? (The loading state is replaced by a generic error message; the sign-in and contact-support links remain accessible)
- What happens if the URL contains a token parameter with an empty value (e.g., `?token=`)? (Treated as a missing token; error shown immediately without a network request)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The confirmation page MUST be publicly accessible — no authentication is required to view or interact with it
- **FR-002**: When the page loads, it MUST immediately check for a token in the URL query string before taking any other action
- **FR-003**: If no token (or an empty token) is present in the URL, the page MUST display an error state immediately without making any network request
- **FR-004**: If a token is present, the page MUST display a loading indicator while the confirmation request is in progress
- **FR-005**: On a successful confirmation response, the page MUST replace the loading state with a success message: "Your email has been confirmed. You can now sign in."
- **FR-006**: The success state MUST include a visible link to the login page
- **FR-007**: On a failed confirmation response (invalid, expired, or already-used token), the page MUST display a clear error message explaining the link is invalid or has expired
- **FR-008**: The error state MUST include a visible link to the login page and a visible link to contact support
- **FR-009**: An authenticated user who lands on the confirmation page MUST be immediately redirected to the main application — the confirmation flow MUST NOT execute for authenticated users
- **FR-010**: The page visual design MUST be consistent with the existing application design system, using the same card layout, typography, and alert components as other public-facing pages

### Key Entities

- **Email Confirmation Token**: A single-use token included in the confirmation link, extracted from the URL query string, and passed to the confirmation endpoint; becomes invalid after use or expiry

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user with a valid confirmation token can complete the email confirmation flow — from clicking the link to seeing the success message — in a single page load with no additional user interaction required
- **SC-002**: The confirmation page correctly handles all three token states (valid, invalid/expired, missing) — each state renders its correct UI and no state causes an unhandled error or blank page
- **SC-003**: An authenticated user who navigates to the confirmation page is redirected to the main app 100% of the time — the confirmation UI is never shown to authenticated users
- **SC-004**: The missing-token error state appears without any network request — verifiable by inspecting network activity on load with no query string present
- **SC-005**: All interactive elements (sign-in link, contact-support link) on the page are keyboard-navigable and meet the same accessibility standard as existing public pages

## Assumptions

- The backend endpoint `GET /api/auth/confirm-email?token=` is fully implemented and returns a 2xx status on success and a 4xx status on failure; no backend changes are required
- "Contact support" links to a `mailto:` address or contact page; if no dedicated contact page exists in the application, a `mailto:` link to a support email address is an acceptable placeholder
- The "main application" for the authenticated-user redirect is `index.html`, the same destination used by other public pages in the project
- An empty string token (`?token=`) is treated the same as an absent token — both trigger the immediate error state without a network call
- The existing API client provides a method for calling the confirmation endpoint; if one does not exist, a minimal wrapper consistent with the client's existing patterns is added as part of implementation
- Automated tests cover the TypeScript module that drives the page behaviour (token extraction, API call, state rendering); visual regression testing of the DaisyUI layout is out of scope
