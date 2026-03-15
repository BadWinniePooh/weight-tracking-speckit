# Feature Specification: Admin & User Management with Email Infrastructure

**Feature Branch**: `007-admin-user-management`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "Extend the weight tracking app with password reset, user self-service, admin user management with a dashboard UI, email confirmation, and an admin audit log. SMTP infrastructure introduced in this iteration powers all email flows."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Password Reset (Priority: P1)

A registered user has forgotten their password and cannot log in. They navigate to the login page, click "Forgot Password", enter their email address, and receive a reset link. They click the link, enter a new password, and are redirected to the login page to sign in with their new credentials. The system never reveals whether a given email exists in the database.

**Why this priority**: Restores access for locked-out users immediately and is the most commonly needed recovery flow. A blocking issue for any user who loses their password.

**Independent Test**: Can be fully tested by triggering a reset request for both an existing and non-existing email (confirming identical responses), following the reset link, submitting a new password, and verifying login with the new password delivers a working authenticated session.

**Acceptance Scenarios**:

1. **Given** a user with a registered email, **When** they submit a password reset request, **Then** a reset email is sent and the response is identical to the response for an unknown email
2. **Given** a valid reset link, **When** the user submits a new password, **Then** the password is updated, the token is invalidated, and the user can log in with the new password
3. **Given** a reset token that has already been used, **When** the user attempts to follow the link again, **Then** the system rejects the request with an appropriate error
4. **Given** a reset token that has expired (older than 1 hour), **When** the user attempts to use it, **Then** the system rejects the request and prompts the user to request a new reset link
5. **Given** an unknown email address, **When** a reset is requested, **Then** the response is identical to a successful request (anti-enumeration)

---

### User Story 2 - Email Confirmation for New Accounts (Priority: P2)

An admin creates a new user account. The system immediately sends a confirmation email to that user's address. The new user clicks the confirmation link, their account is marked as confirmed, and they can log in for the first time. Until confirmed, any login attempt is rejected with a clear message prompting them to check their email.

**Why this priority**: Email confirmation is a security gate that prevents unauthorized account creation and ensures contact information is valid before granting access.

**Independent Test**: Can be fully tested by having an admin create a user, verifying the user cannot log in before confirming, following the confirmation link, and verifying login succeeds.

**Acceptance Scenarios**:

1. **Given** an admin creates a new user, **When** the account is created, **Then** a confirmation email is sent to the user's email address
2. **Given** a new unconfirmed user, **When** they attempt to log in, **Then** the login is rejected with a message to confirm their email
3. **Given** a valid confirmation link, **When** the user clicks it, **Then** the account is marked confirmed and the user can log in
4. **Given** a confirmation token older than 24 hours, **When** the user attempts to confirm, **Then** the token is rejected and the user is advised to request a new one
5. **Given** a user whose confirmation token has expired, **When** an admin resends the confirmation email, **Then** a new valid token is issued and the old one is invalidated

---

### User Story 3 - User Self-Service Account Changes (Priority: P3)

A logged-in user wants to update their account details. They can change their username directly. They can change their password by providing their current password first. They can change their email address, which triggers a confirmation email to the new address — their old email remains valid for login until the new address is confirmed.

**Why this priority**: Empowers users to maintain accurate account information without admin involvement, reducing support burden.

**Independent Test**: Can be fully tested by authenticating as a regular user, performing each change type, and verifying the outcome (immediate for username/password, deferred confirmation for email change).

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they submit a new username, **Then** the username is updated immediately
2. **Given** an authenticated user, **When** they submit a password change with the correct current password, **Then** the password is updated and old credentials no longer work
3. **Given** an authenticated user, **When** they submit an incorrect current password for a password change, **Then** the request is rejected
4. **Given** an authenticated user, **When** they change their email address, **Then** a confirmation email is sent to the new address and their old email remains active until confirmed
5. **Given** a user who has initiated an email change, **When** they confirm the new email, **Then** the new email becomes active and the old email is no longer associated with the account

---

### User Story 4 - Admin User Management (Priority: P2)

An admin opens the admin dashboard and sees a table of all registered users with their status, roles, last login, and scheduled deletion dates. The admin can create new users, deactivate users (scheduling them for deletion after a grace period), reactivate deactivated users, immediately delete users, change user roles, and resend confirmation emails. An admin cannot perform any of these actions on their own account.

**Why this priority**: Central to the administrative control of the platform. Needed to manage users at scale and respond to security or compliance incidents.

**Independent Test**: Can be fully tested by logging in as an admin, performing each management action on a test user, and confirming the expected state change via the user list and login behavior.

**Acceptance Scenarios**:

1. **Given** an admin is on the dashboard, **When** they view the user list, **Then** each user row shows: username, email, role, status, last login, and scheduled deletion date
2. **Given** an admin creates a new user, **When** the form is submitted, **Then** the user is created and a confirmation email is sent
3. **Given** an admin deactivates a user, **When** deactivation is confirmed, **Then** the user cannot log in and a deletion date is scheduled based on the configured grace period
4. **Given** an admin reactivates a previously deactivated user, **When** reactivation is confirmed, **Then** the user can log in and the scheduled deletion date is removed
5. **Given** an admin immediately deletes a user, **When** deletion is confirmed, **Then** the user and all associated data are permanently removed
6. **Given** an admin attempts to deactivate, delete, or change the role of their own account, **When** the action is submitted, **Then** the system rejects it with an appropriate error

---

### User Story 5 - Admin Audit Log (Priority: P3)

An admin reviews the audit log to see a history of all administrative actions taken on the platform. They can filter by date range and action type. Each log entry shows the action performed, who performed it, which user was affected (if any), when it happened, and the IP address of the actor.

**Why this priority**: Supports accountability, incident response, and compliance. Provides a tamper-evident record of all admin actions.

**Independent Test**: Can be fully tested by performing several admin actions, then viewing the audit log and confirming that each action appears with correct details, and that filtering works correctly.

**Acceptance Scenarios**:

1. **Given** an admin performs any management action, **When** the action completes, **Then** an audit log entry is created with: action type, acting admin ID, target user ID, timestamp, and IP address
2. **Given** an admin views the audit log, **When** they apply a date range filter, **Then** only entries within that range are returned
3. **Given** an admin views the audit log, **When** they filter by action type, **Then** only entries of that action type are shown
4. **Given** a non-admin user, **When** they attempt to access the audit log, **Then** the request is rejected

---

### User Story 6 - Automated Deletion of Deactivated Users (Priority: P2)

The system automatically and permanently deletes users whose scheduled deletion date has passed. Each deletion removes the user and all their associated data atomically. This runs daily on startup and every 24 hours thereafter.

**Why this priority**: Ensures deactivated user data is not retained indefinitely, supporting data minimization and compliance goals.

**Independent Test**: Can be fully tested by deactivating a user with a past-due deletion date, triggering the daily job, and confirming the user and all associated data are permanently removed.

**Acceptance Scenarios**:

1. **Given** a user whose scheduled deletion date has passed, **When** the daily cleanup runs, **Then** the user and all associated data (weight entries, chart settings, refresh tokens) are permanently deleted
2. **Given** the deletion process, **When** it runs, **Then** each user's deletion is atomic — partial failures do not leave inconsistent data
3. **Given** a reactivated user, **When** the cleanup runs, **Then** the user is not deleted

---

### Edge Cases

- What happens when an SMTP server is unavailable when an email is triggered? (The action succeeds but the email failure is logged; admins can retry via the resend confirmation action)
- What happens if a user attempts to change their email to an address already in use? (Request is rejected with a clear error)
- What happens if the deletion grace period environment variable is not set? (Defaults to 30 days)
- What happens if a user has a pending email change and is deactivated before confirming? (Pending confirmation token is discarded on deactivation)
- What happens when a confirmation or reset link is accessed from a different browser or device? (Tokens are not device-bound; the link works on any device)
- What happens if two admins attempt to delete the same user simultaneously? (One succeeds; the second receives a not-found response)

## Requirements *(mandatory)*

### Functional Requirements

**SMTP / Email Infrastructure**

- **FR-001**: The system MUST send all emails via a generic SMTP server configured entirely through environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SENDER_EMAIL`)
- **FR-002**: The system MUST NOT contain any provider-specific email code; any RFC-compliant SMTP server MUST work without code changes
- **FR-003**: The email sending capability MUST be defined as a domain-level port (interface), implemented as an infrastructure adapter, and injected via dependency injection

**Password Reset**

- **FR-004**: The system MUST provide an unauthenticated endpoint to request a password reset by email address
- **FR-005**: The password reset response MUST be identical regardless of whether the email address exists in the system (anti-enumeration protection)
- **FR-006**: Reset tokens MUST be single-use and expire after 1 hour
- **FR-007**: The system MUST invalidate a reset token immediately after it is successfully used
- **FR-008**: The reset link MUST include the token and route the user to a password reset form

**Email Confirmation**

- **FR-009**: The system MUST send a confirmation email when an admin creates a new user account
- **FR-010**: Users MUST confirm their email address before their first login is permitted
- **FR-011**: Confirmation tokens MUST be single-use and expire after 24 hours
- **FR-012**: If a user changes their email address, a confirmation email MUST be sent to the new address; the old address MUST remain active until the new address is confirmed
- **FR-013**: Admins MUST be able to resend a confirmation email for any unconfirmed user

**User Self-Service**

- **FR-014**: Authenticated users MUST be able to change their own username
- **FR-015**: Authenticated users MUST be able to change their own password by providing their current password
- **FR-016**: Authenticated users MUST be able to change their own email address, triggering the email confirmation flow

**Admin User Management**

- **FR-017**: Admins MUST be able to create a new user account specifying username, email, and role
- **FR-018**: Admins MUST be able to deactivate a user, which prevents login and schedules the user for permanent deletion after a configurable grace period (`USER_DELETION_GRACE_DAYS`, default 30)
- **FR-019**: Admins MUST be able to reactivate a deactivated user, cancelling the scheduled deletion and restoring login access
- **FR-020**: Admins MUST be able to immediately and permanently delete a user, bypassing the grace period
- **FR-021**: Admins MUST be able to assign or change a user's role (admin or user)
- **FR-022**: The user list MUST expose: id, username, email, role, isActive, createdAt, lastLoginAt, scheduledDeletionAt, emailConfirmed
- **FR-023**: Admins MUST NOT be able to deactivate, delete, or change the role of their own account
- **FR-024**: Immediate user deletion MUST remove all associated data: weight entries, chart settings, refresh tokens

**User Deletion Background Service**

- **FR-025**: A background service MUST run on startup and every 24 hours thereafter to permanently delete users whose scheduled deletion date has passed
- **FR-026**: Each user deletion MUST be atomic (database transaction); failure for one user MUST NOT prevent deletion of others
- **FR-027**: The background service MUST be defined as a domain port and implemented as an infrastructure adapter registered via dependency injection

**Admin Audit Log**

- **FR-028**: Every admin action MUST be recorded with: action type, acting admin user ID, target user ID (if applicable), timestamp, and IP address of the actor
- **FR-029**: The audit log MUST be append-only; no modifications or deletions are permitted
- **FR-030**: The audit log MUST only be accessible to users with the admin role
- **FR-031**: The audit log API MUST support pagination and filtering by date range and action type

**Admin Dashboard UI**

- **FR-032**: The admin dashboard MUST be accessible only to authenticated users with the admin role, following the existing auth-guard pattern
- **FR-033**: The dashboard MUST display a user management table with: username, email, role, status (active / deactivated / pending confirmation), last login, and scheduled deletion date
- **FR-034**: Each user row MUST include action controls for: deactivate, reactivate, delete, assign role, and resend confirmation email
- **FR-035**: The dashboard MUST display summary statistics: total registered users, count of users with a currently valid refresh token (active sessions), and last login time per user
- **FR-036**: The dashboard MUST include an audit log view with a paginated table filterable by date range and action type
- **FR-037**: A navigation link to the admin dashboard MUST be visible only to users with the admin role in the main application navigation

### Key Entities

- **PasswordResetToken**: Single-use token tied to a user, with expiry timestamp and used/unused status
- **EmailConfirmationToken**: Single-use token tied to a user and a target email address, with expiry timestamp and used/unused status
- **User** (extended): Gains `isActive`, `scheduledDeletionAt`, `emailConfirmed`, `pendingEmail` (new address awaiting confirmation), `lastLoginAt`
- **AuditLogEntry**: Action type, acting admin user ID, target user ID (nullable), timestamp, IP address — immutable after creation
- **Role**: Enumeration of `admin` and `user` (existing, unchanged)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who has forgotten their password can regain access to their account within 5 minutes of initiating the reset flow
- **SC-002**: Password reset requests return identical responses for known and unknown emails in 100% of cases, verified by automated tests
- **SC-003**: A new user account created by an admin is not accessible until the user has confirmed their email, verified by attempting login before and after confirmation
- **SC-004**: Admins can perform all user management operations (create, deactivate, reactivate, delete, role change, resend confirmation) from a single dashboard page without navigating away
- **SC-005**: All admin actions appear in the audit log within the same request cycle, with no missing entries for any auditable action
- **SC-006**: Users whose scheduled deletion date has passed are permanently deleted (including all associated data) within 24 hours of the deadline
- **SC-007**: Each user deletion in the background service is atomic — no partial deletions leave orphaned records, verified by tests
- **SC-008**: Self-service account changes (username, password, email) complete and take effect within one user interaction
- **SC-009**: The admin dashboard loads and renders the user list within a reasonable time for datasets of up to 10,000 users
- **SC-010**: All email flows (confirmation, reset) function correctly with any RFC-compliant SMTP server without code changes, verified by integration test against a local SMTP stub

## Assumptions

- SMTP credentials and configuration are provided at deployment time; the system does not validate or test the SMTP connection on startup
- The reset and confirmation link base URL is injected via environment variable or derived from the incoming request's host header
- "Active session" for the dashboard summary stats means a user with at least one non-expired refresh token in the database
- Role assignments are binary (admin or user); no intermediate roles are required in this iteration
- Immediate deletion by an admin is intended for exceptional circumstances (abuse, legal) and does not require an additional grace period
- Email templates are plain-text or minimal HTML; no dedicated template engine is required beyond string interpolation
- The audit log does not need to be exportable (CSV/PDF) in this iteration
- Users can have at most one pending email change at a time; initiating a second change replaces the previous pending confirmation token
