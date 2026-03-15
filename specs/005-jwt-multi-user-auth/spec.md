# Feature Specification: Multi-User Support and Authentication

**Feature Branch**: `005-jwt-multi-user-auth`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "Introduce multi-user support and JWT authentication to the weight tracking app. This iteration replaces the stub user resolver with real authentication and adds user management capabilities."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure User Login (Priority: P1)

A registered user navigates to the application and sees a login page. They enter their username and password and are granted access to their personal weight tracking dashboard. Their session persists securely and they remain logged in across browser refreshes without needing to log in again. When their session expires they are silently re-authenticated in the background; only if that fails are they redirected back to the login page.

**Why this priority**: Without authentication, no other multi-user capability is possible. This is the gate that all other stories depend on.

**Independent Test**: Navigate to the app, submit valid credentials, and confirm the dashboard loads showing only the current user's data. Close and reopen the browser tab — confirm the user remains logged in. Let the access credential expire and confirm the app continues to work without prompting for a password.

**Acceptance Scenarios**:

1. **Given** a registered user exists, **When** they enter correct username and password, **Then** they are redirected to their personal dashboard and can see their weight data.
2. **Given** a user is logged in, **When** the short-lived access credential expires, **Then** a new one is obtained silently in the background without interrupting the user.
3. **Given** both the access credential and refresh credential have expired, **When** the user makes a request, **Then** they are redirected to the login page.
4. **Given** a user enters an incorrect password, **When** they submit the login form, **Then** they see a generic "invalid credentials" message and are not logged in (the message does not reveal which field was wrong).
5. **Given** a user is logged in, **When** they explicitly log out, **Then** their session is invalidated and they are returned to the login page.

---

### User Story 2 - First-Run Setup Wizard (Priority: P2)

On a brand-new installation with no users in the system, anyone who accesses the application is presented with a one-time setup wizard. They enter a username, email address, and password to create the initial administrator account. Once submitted, the wizard is permanently disabled — subsequent visitors see the normal login page.

**Why this priority**: Without an initial admin account the entire system is inaccessible. This story unblocks all others for new deployments.

**Independent Test**: Deploy the application against an empty database, open the app, complete the wizard, verify the admin account is created, then refresh — confirm the wizard no longer appears and the login page is shown instead.

**Acceptance Scenarios**:

1. **Given** the database contains no users and no admin environment variables are set, **When** any visitor opens the app, **Then** the first-run wizard is shown instead of the login page.
2. **Given** the wizard is displayed, **When** the user submits a valid username, email, and password, **Then** an administrator account is created and the user is logged in.
3. **Given** the wizard has been completed and at least one user exists, **When** any visitor opens the app, **Then** the login page is shown and the wizard is inaccessible.
4. **Given** admin environment variables are configured at startup, **When** the application starts for the first time, **Then** the admin account is created automatically and the first-run wizard is never shown to visitors.

---

### User Story 3 - Password Reset via Email (Priority: P3)

A user who has forgotten their password clicks "Forgot password" on the login page, enters their email address, and receives an email containing a secure one-time link. Clicking that link takes them to a page where they can enter a new password. After a successful reset they are redirected to the login page.

**Why this priority**: Recoverable accounts are essential for usability but do not block initial access.

**Independent Test**: Use a known user account, request a password reset, receive the email, follow the link, set a new password, then confirm login works with the new password and fails with the old one.

**Acceptance Scenarios**:

1. **Given** a user enters their registered email address, **When** they submit the reset request, **Then** they receive an email with a reset link and see a confirmation message (the same message is shown even if the email is not registered, to prevent enumeration).
2. **Given** a valid reset link, **When** the user sets a new password, **Then** their password is updated and they can log in with the new password; the old password no longer works.
3. **Given** a reset link that has already been used or has expired, **When** the user clicks it, **Then** they see an error message and are prompted to request a new reset link.

---

### User Story 4 - Data Isolation Between Users (Priority: P4)

Each user can only see and modify their own weight entries and chart settings. No user can access another user's data, even by guessing resource identifiers.

**Why this priority**: Privacy is a core trust requirement; without isolation, multi-user support is unsafe.

**Independent Test**: Create two user accounts, add weight entries to each, then verify that each user's responses contain only their own data and that attempts to access the other user's resources are denied.

**Acceptance Scenarios**:

1. **Given** two users both have weight entries, **When** each logs in and views their data, **Then** each sees only their own entries.
2. **Given** a logged-in regular user, **When** they attempt to access or modify another user's weight entry by guessing an ID, **Then** the request is denied.
3. **Given** a logged-in regular user, **When** they update their chart settings, **Then** only their settings are affected; the other user's settings remain unchanged.

---

### User Story 5 - Administrator User Management (Priority: P5)

An administrator can create new user accounts, deactivate accounts (preventing login without deleting data), delete accounts entirely, list all users, and change a user's role. An administrator cannot deactivate or delete their own account.

**Why this priority**: User management enables the app to serve multiple people but is an admin-only workflow that does not affect day-to-day use by regular users.

**Independent Test**: Log in as an admin, create a new user account, verify the new user can log in, deactivate the account, verify the user can no longer log in, then re-enable and delete the account.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** they create a new user (username, email, password, role), **Then** the account is created and the new user can log in.
2. **Given** an admin deactivates a user account, **When** the deactivated user attempts to log in, **Then** they are denied access with an appropriate message.
3. **Given** an admin deletes a user account, **When** any user attempts to log in with those credentials, **Then** login fails and the account's data is removed.
4. **Given** an admin is logged in, **When** they attempt to deactivate or delete their own account, **Then** the request is rejected with a clear explanation.
5. **Given** an admin assigns the admin role to a regular user, **When** that user logs in, **Then** they have admin capabilities.
6. **Given** a regular user is logged in, **When** they attempt to access admin user-management endpoints, **Then** the request is denied.

---

### Edge Cases

- What happens when a deactivated user's browser still holds a valid access credential? The server must check account status on every request and reject credentials belonging to deactivated accounts.
- How does the system handle a reset-link request for an email address not in the system? A confirmation message is always shown to prevent email enumeration.
- What if two administrators try to delete the same account simultaneously? The second request should gracefully handle the "not found" condition without error.
- What if the mail server is unreachable when a password reset is requested? The user sees a friendly error asking them to try again; the error is logged server-side.
- What happens if the admin environment variable account already exists when the application restarts? The seed step is skipped; no duplicate is created.
- What if a deactivated user still has an unexpired refresh credential stored in their browser cookie? It must be rejected and the user returned to the login page.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: The system MUST require users to authenticate with a username and password before accessing any personal data or administrative functions.
- **FR-002**: The system MUST issue a short-lived access credential and a long-lived refresh credential upon successful login.
- **FR-003**: The long-lived refresh credential MUST be stored in a secure, HTTP-only cookie that is not accessible to browser scripts.
- **FR-004**: The system MUST transparently renew the access credential using the refresh credential without requiring the user to log in again.
- **FR-005**: The system MUST invalidate all credentials on explicit logout.
- **FR-006**: The system MUST store passwords in a non-reversible hashed form; plaintext passwords must never be persisted or logged.
- **FR-007**: Login error messages MUST NOT reveal whether the failure was due to an unknown username or incorrect password.
- **FR-008**: The system MUST verify account active status on every authenticated request, not only at login time.

**Password Reset**

- **FR-009**: The system MUST provide a password reset flow triggered by email address.
- **FR-010**: The system MUST send password reset emails via any standards-compliant SMTP server, configured entirely through environment variables (host, port, credentials, sender address) with no provider-specific code.
- **FR-011**: Reset links MUST be single-use and expire after 1 hour.
- **FR-012**: The password reset response MUST be identical whether or not the submitted email address is registered.

**User Roles**

- **FR-013**: The system MUST support exactly two roles: administrator and regular user.
- **FR-014**: Regular users MUST only be able to read and write their own weight entries and chart settings.
- **FR-015**: Administrators MUST be able to create, deactivate, re-activate, delete, and list user accounts, and assign roles.
- **FR-016**: Administrators MUST NOT be able to deactivate or delete their own account.

**Initial Bootstrap**

- **FR-017**: If administrator environment variables (username, email, password) are present at startup and no matching admin account exists, the system MUST create the admin account automatically without requiring any user interaction.
- **FR-018**: If no environment variables are present and no users exist in the database, the system MUST present a first-run wizard to the first visitor.
- **FR-019**: Once any user account exists in the database, the first-run wizard MUST be permanently inaccessible.

**Data Isolation**

- **FR-020**: Every weight entry and chart-settings record MUST be associated with exactly one user and returned only to that user.
- **FR-021**: The system MUST enforce data isolation server-side; client-side filtering alone is not acceptable.

**Frontend Pages**

- **FR-022**: The application MUST include a login page with username and password fields.
- **FR-023**: The application MUST include a password reset request page accepting an email address.
- **FR-024**: The application MUST include a password reset completion page accepting a new password, reached via the link in the reset email.
- **FR-025**: The application MUST include the first-run wizard page, shown only when the server indicates first-run mode is active.
- **FR-026**: On access-credential expiry, the application MUST attempt a silent refresh; only on refresh failure must it redirect to the login page.

### Key Entities

- **User**: A person with access to the system. Has a unique username, email address, hashed password, role (administrator or regular user), and an active/inactive status.
- **Refresh Credential**: A long-lived secret associated with a user session. Single-use; exchanged for a new access credential. Invalidated on logout or account deactivation.
- **Password Reset Token**: A short-lived, single-use secret sent by email to verify ownership of an account before allowing a password change. Expires after 1 hour.
- **Weight Entry**: An existing entity now explicitly owned by and isolated to a single User.
- **Chart Settings**: An existing entity now explicitly owned by and isolated to a single User.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can log in and reach their personal dashboard in under 3 seconds on a standard connection.
- **SC-002**: Silent credential renewal is invisible to the user — no loading indicators or interruptions appear during normal browsing when a session is refreshed in the background.
- **SC-003**: A password reset email is delivered within 60 seconds of the request under normal mail-server conditions.
- **SC-004**: An administrator can create, deactivate, and delete a user account with no more than 3 interactions per operation via the API.
- **SC-005**: Zero weight entries or chart-settings records are accessible to any user other than their owner, verified by automated cross-user access tests.
- **SC-006**: First-run wizard completion results in a working admin account in under 2 minutes for a new installation.
- **SC-007**: All endpoints that return personal data return an unauthenticated-access error for unauthenticated requests and an authorization error for authenticated requests from unauthorized users.

## Assumptions

- Access credential lifetime defaults to 15 minutes; refresh credential lifetime defaults to 30 days. Both are reasonable secure defaults and may be made configurable in a future iteration.
- Password reset links expire after 1 hour — a standard default balancing security and usability.
- Usernames are treated as case-insensitive for login purposes to avoid confusion between "Alice" and "alice".
- No self-registration: only administrators create new accounts. This is explicit in the feature description.
- User management UI (admin screens) is deferred to a future spec (spec 006); this spec delivers the underlying API endpoints and auth infrastructure only.
- Email delivery failure is treated as a transient error — the system logs it and returns a user-friendly message; a retry queue is not required in this iteration.
- If SMTP is not configured, the password reset endpoint is unavailable and the option is hidden from users.

## Dependencies

- **Spec 003** (Backend API Migration): introduces the `ICurrentUserResolver` stub that this spec replaces with a real implementation. The stub must remain functional until this spec's implementation is merged.
- **Spec 004** (Repo Restructure): establishes the final directory layout that this spec's files follow.
- **Spec 006** (planned): Admin User Management UI — depends on the user management API endpoints delivered by this spec.
