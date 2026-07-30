# Feature Specification: JWT Authentication and First-Run Setup

**Feature Branch**: `006-jwt-auth-setup`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "Introduce JWT authentication and a first-run setup wizard to the weight tracking app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-Run Setup Wizard (Priority: P1)

A brand-new installation of the app has no user accounts. The first person to visit the app must complete a one-time setup wizard to create the administrator account before anyone can use the application. Once setup is complete, the wizard is no longer accessible.

**Why this priority**: Without an admin account, the application cannot be used at all. This is the foundational unlock for all other functionality.

**Independent Test**: Can be fully tested by deploying a fresh instance with no existing users, navigating to the app, completing the setup form, and verifying that the admin account is created and that the setup page is no longer accessible afterward.

**Acceptance Scenarios**:

1. **Given** no users exist in the system, **When** a visitor navigates to any page of the application, **Then** they are automatically redirected to the setup wizard before any content is shown.
2. **Given** the setup wizard is displayed, **When** the visitor submits a valid username, email, and password, **Then** the admin account is created and the visitor is redirected to the login page.
3. **Given** an admin account already exists, **When** a request is made to create another account via the setup endpoint, **Then** the request is rejected with a conflict response and no new account is created.
4. **Given** the required admin credentials are provided via environment configuration at application startup and no users exist, **When** the application starts, **Then** the admin account is created automatically and the interactive setup wizard is skipped entirely.
5. **Given** setup is complete and a user is already authenticated, **When** they navigate to the setup page, **Then** they are redirected to the main application instead.

---

### User Story 2 - User Login and Session Establishment (Priority: P2)

A registered user enters their username and password on the login page to gain access to the weight tracking application. On success, they are taken directly to the main app. Their session persists as they navigate between pages without requiring repeated logins.

**Why this priority**: Authentication is the gatekeeper for all application functionality. Without it, no data can be viewed or entered.

**Independent Test**: Can be fully tested by logging in with valid credentials and verifying access to protected content, then attempting login with invalid credentials and verifying access is denied.

**Acceptance Scenarios**:

1. **Given** setup is complete and a user account exists, **When** the user submits their correct username and password, **Then** they are authenticated and redirected to the main application.
2. **Given** the login page is displayed, **When** the user submits an incorrect username or password, **Then** they see a clear error message and remain on the login page.
3. **Given** a user is already authenticated, **When** they navigate to the login page, **Then** they are redirected to the main application instead.
4. **Given** an unauthenticated user navigates directly to a protected page, **When** the page loads, **Then** they are redirected to the login page before any content is shown.

---

### User Story 3 - Secure Session Continuity (Priority: P3)

A logged-in user reloads the browser tab or navigates away and returns. Their session is automatically restored without requiring them to log in again, provided their session is still valid. If their short-lived credential has expired, it is silently renewed in the background.

**Why this priority**: Without session continuity, users would need to log in on every page load — a severe usability regression for an app used regularly throughout the day.

**Independent Test**: Can be fully tested by logging in, reloading the page, and verifying the user is still authenticated and the app content loads without a login prompt.

**Acceptance Scenarios**:

1. **Given** a user is authenticated and reloads the page, **When** the page loads, **Then** their session is restored automatically and the main application is displayed without a login prompt.
2. **Given** a user's short-lived credential has expired during use, **When** they perform an action that requires authentication, **Then** the system silently obtains a new credential and retries the action without interrupting the user.
3. **Given** a user's session cannot be restored on page reload (e.g., they logged out in another tab), **When** the page loads, **Then** they are redirected to the login page and treated as unauthenticated.

---

### User Story 4 - Logout (Priority: P4)

A logged-in user can explicitly log out of the application. After logging out, their session is fully invalidated on the server. They are redirected to the login page and cannot access protected content using their previous session credentials.

**Why this priority**: Secure logout is a core security requirement, especially for shared or public devices.

**Independent Test**: Can be fully tested by logging in, logging out, and verifying that attempts to access protected resources with the old session are rejected.

**Acceptance Scenarios**:

1. **Given** a user is authenticated and clicks the logout button, **When** the logout action completes, **Then** their session is invalidated on the server, all in-memory credentials are cleared, and they are redirected to the login page.
2. **Given** a user has logged out, **When** they attempt to access any protected page (e.g., via browser back button), **Then** they are redirected to the login page and no protected content is shown.
3. **Given** a user has logged out, **When** their browser attempts to silently restore the session using the old refresh token, **Then** the restoration fails and the user remains on the login page.

---

### Edge Cases

- What happens when the setup wizard is accessed after the admin account already exists? → Request is rejected; existing users are not affected.
- What happens when the password and confirm-password fields do not match in the setup wizard? → Submission is blocked with a clear validation message.
- What happens when the application cannot reach the backend to check setup/auth status? → The page shows an appropriate error rather than silently failing or exposing protected content.
- What happens when a session renewal attempt fails (e.g., refresh token expired)? → In-memory credentials are cleared and the user is redirected to the login page.
- What happens when environment variables for automated setup are only partially provided? → Automated setup does not run; the interactive first-run wizard is used instead.
- What happens to previously existing weight data from the legacy stub user? → All such data is removed as part of this migration; the stub user account is deleted.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: Users MUST be able to log in by providing a username and password.
- **FR-002**: User passwords MUST be stored using industry-standard cryptographic hashing — plaintext passwords MUST never be stored or logged.
- **FR-003**: Successful login MUST return a short-lived authentication credential to the client.
- **FR-004**: Successful login MUST also establish a long-lived session token stored in a secure, tamper-resistant browser cookie that is inaccessible to client-side scripts.
- **FR-005**: The system MUST provide an endpoint that exchanges a valid session cookie for a new short-lived authentication credential, enabling silent session renewal.
- **FR-006**: Users MUST be able to log out; logout MUST invalidate the session token on the server and clear all session data from the client.
- **FR-007**: All weight entry, chart, and settings endpoints MUST reject requests that do not include a valid authentication credential, returning an "unauthorized" response.

**First-Run Setup**

- **FR-008**: The system MUST provide a public status endpoint that reports whether initial setup has been completed (i.e., whether any user accounts exist).
- **FR-009**: The system MUST provide a public setup endpoint that accepts a username, email address, and password to create the first admin account; this endpoint MUST be rejected if any user already exists.
- **FR-010**: When all required admin credentials are provided via environment configuration at startup and no users exist, the system MUST automatically create the admin account and skip the interactive setup wizard.

**User Accounts**

- **FR-011**: Each user account MUST have a unique identifier, unique username, email address, role (admin or standard user), active/inactive status, and creation timestamp.
- **FR-012**: The legacy stub user account and all weight data previously associated with it MUST be removed as part of this migration.

**Frontend Routing and Security**

- **FR-013**: Every page MUST check setup and authentication status before rendering any content and redirect appropriately.
- **FR-014**: Visitors accessing any page when no users exist MUST be redirected to the setup wizard.
- **FR-015**: Unauthenticated visitors accessing any protected page MUST be redirected to the login page.
- **FR-016**: Already-authenticated users visiting the login or setup pages MUST be redirected to the main application.
- **FR-017**: Short-lived authentication credentials MUST be stored only in application memory; they MUST NOT be written to persistent browser storage or readable cookies.
- **FR-018**: When an authenticated request is rejected as unauthorized, the system MUST attempt one silent session renewal before redirecting the user to the login page.
- **FR-019**: On every page load, the system MUST attempt to restore a previous session silently; if restoration fails, the user is treated as unauthenticated.
- **FR-020**: Cross-origin requests with credentials MUST be restricted to an explicitly configured allowed origin; wildcard origins are not permitted.

### Key Entities

- **User**: Represents an authenticated account in the system. Has a unique identifier, username, email address, role (admin or standard user), active/inactive status, and creation date. Passwords are stored only as a secure hash.
- **Authentication Session**: Represents an active login. Comprises a short-lived access credential (held in application memory) and a long-lived session token (held in a secure browser cookie). The session can be renewed silently or invalidated on logout. Server-side invalidation records ensure logged-out sessions cannot be reused.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A brand-new installation reaches a usable, authenticated state in under 3 minutes using the setup wizard.
- **SC-002**: A user can log in successfully within 5 seconds of submitting valid credentials.
- **SC-003**: Session restoration on page reload completes within 2 seconds without user interaction, when the session is still valid.
- **SC-004**: 100% of protected application endpoints reject requests with missing or invalid authentication credentials.
- **SC-005**: A user who has logged out cannot access any protected resource using their previous session credentials.
- **SC-006**: The first-run setup endpoint rejects all attempts to create an account once any user exists — 0% of post-setup creation requests succeed.
- **SC-007**: Automated admin account creation via environment configuration succeeds on 100% of startup attempts when all required values are provided and no users exist.
- **SC-008**: Silent session renewal succeeds without any visible interruption to the user when the session is still valid.

## Development Constraints *(non-negotiable — override any default agent behavior)*

### TDD Enforcement

The following rules apply to every implementation task in this feature without exception:

1. **Strict TDD order** — for every implementation task, this sequence is mandatory and must not be skipped or reversed:
   - Write a failing test in `WeightTracker.Tests` (or `frontend/tests/`) first
   - Run the test suite and confirm the new test fails (red)
   - Write the minimum implementation code to make the test pass
   - Run the test suite and confirm the test passes (green)
   - Only then move to the next task

2. **No implementation file without a prior failing test** — if a phase begins with an implementation task and no corresponding test file exists yet, stop and write the test first. Do not write any implementation code before a failing test exists.

3. **Test files mirror implementation structure**:
   - `WeightTracker.Infrastructure/Services/Foo.cs` → `WeightTracker.Tests/Unit/Services/FooTests.cs`
   - `WeightTracker.Infrastructure/Repositories/FooRepository.cs` → `WeightTracker.Tests/Integration/Repositories/FooRepositoryTests.cs`
   - `WeightTracker.Api/Endpoints/FooEndpoints.cs` → `WeightTracker.Tests/Integration/Endpoints/FooEndpointsTests.cs`
   - Frontend TypeScript modules in `frontend/src/ts/` → test files in `frontend/tests/`

4. **Commit after each phase** — once all tasks in a phase are complete and all tests pass, run `/commit` before starting the next phase.

5. **Constitution violation** — skipping the failing-test step is a violation of Constitution Principle III (Test-First, NON-NEGOTIABLE). If a failing test cannot be written before implementation (e.g., missing interface, blocked dependency), stop and report the blocker explicitly rather than proceeding without a test.

---

## Assumptions

- A single admin account is sufficient for this iteration; multi-user management and role-based access beyond admin/standard are deferred.
- Access credentials are short-lived (assumed ~15 minutes); session tokens are long-lived (assumed ~7 days) — exact durations are an implementation detail.
- Password validation requires a minimum of 8 characters; additional complexity rules are not specified and will use reasonable defaults.
- The confirmation password field (in setup) is a client-side validation concern; the backend requires only one password field.
- Automated setup via environment variables requires all three values (username, email, password) to be present; partial configuration does not trigger automatic setup.
- The app currently has a single stub user with associated weight data; all of that data is considered disposable and will be removed.
- The "standard user" role is included in the data model for forward compatibility but has no distinct behavior in this iteration.

## Out of Scope

- Password reset / forgot password flow
- Admin user management (invite, deactivate, delete other users)
- Account merging
- Multi-factor authentication
- OAuth2 / SSO integration
- Email verification
- Rate limiting on login attempts (deferred to a hardening iteration)

---

## Clarifications

### Session 2026-03-15

- Q: What TDD enforcement rules apply to this feature and override default agent behavior? → A: Strict red-green TDD sequence mandatory for every task; no implementation without a prior failing test; test file paths mirror implementation paths; commit after each phase; skipping the failing-test step is a Constitution Principle III violation that must be reported, not silently bypassed.
