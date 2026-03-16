# Feature Specification: Frontend Admin UI and User-Facing Pages

**Feature Branch**: `008-frontend-admin-ui`
**Created**: 2026-03-16
**Status**: Draft

## Clarifications

### Session 2026-03-16

- Q: How are admin summary stats (total users, active sessions) sourced? → A: Derived client-side from the existing GET /api/admin/users response — total users is the array length; active sessions is the count of users where `isActive = true` AND `lastLoginAt` is non-null. No dedicated stats endpoint or backend change required.
- Q: How does the audit log display the actor's name? → A: The backend AuditLogEntryDto must be amended to include `actorUsername` (string) alongside the existing `actorUserId` — resolved via a join at query time. The frontend displays `actorUsername` directly; no client-side ID-to-name lookup. This backend amendment is a required polish-phase change within this iteration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin User Management (Priority: P1)

An admin user navigates to the admin dashboard to manage all registered accounts. They can view a table of all users with their current status, perform per-row actions (deactivate, reactivate, delete, change role, resend confirmation email), and create new users via a modal form — all without leaving the page.

**Why this priority**: The admin dashboard is the core deliverable of this iteration. It unlocks all account lifecycle management capabilities and is the most complex new page.

**Independent Test**: Can be fully tested by loading admin.html as an authenticated admin, exercising each user action in the table, and verifying the table updates in place after each action.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they navigate to admin.html, **Then** a table of all users is shown with columns: username, email, role, status, last login, and scheduled deletion date (visible only for deactivated users)
2. **Given** an active user row, **When** the admin clicks Deactivate, **Then** a confirmation dialog appears before the action is executed
3. **Given** a deactivated user row, **When** the admin clicks Reactivate, **Then** the user's status updates in the table without a page reload
4. **Given** any user row for the currently logged-in admin's own account, **When** the admin views the row actions, **Then** deactivate, delete, and change role actions are disabled with an explanatory tooltip
5. **Given** the admin clicks Create User, **When** they fill in username, email, and role and submit, **Then** the new user row appears in the table immediately without a page reload
6. **Given** a non-admin authenticated user, **When** they attempt to navigate to admin.html, **Then** they are redirected to index.html
7. **Given** an unauthenticated user, **When** they attempt to navigate to admin.html, **Then** they are redirected to login.html

---

### User Story 2 - Admin Audit Log Viewing (Priority: P2)

An admin user navigates to the audit log section of the admin dashboard to review a paginated, filterable history of administrative actions.

**Why this priority**: Audit visibility is a security accountability requirement. It is a self-contained section of the admin page with no overlap with the user management table.

**Independent Test**: Can be fully tested by viewing the audit log section, applying date and action-type filters, and navigating between pages of results.

**Acceptance Scenarios**:

1. **Given** an authenticated admin on admin.html, **When** the audit log section loads, **Then** a table of up to 20 entries per page is shown with columns: timestamp, admin username, action type, and target username (if applicable)
2. **Given** the audit log table is visible, **When** the admin sets a date range filter and applies it, **Then** only entries within that range are displayed
3. **Given** the audit log table is visible, **When** the admin selects an action type from the filter dropdown, **Then** only entries matching that action type are displayed
4. **Given** there are more than 20 entries, **When** the admin clicks Next, **Then** the next page of results loads and the page indicator updates
5. **Given** the admin is on page 2 or beyond, **When** they click Previous, **Then** the previous page loads

---

### User Story 3 - Password Reset Flow (Priority: P3)

A user who has forgotten their password can request a reset link via a dedicated page and then complete the reset using a tokenised link sent to their email.

**Why this priority**: Password recovery is an essential account access flow. Both pages are publicly accessible and do not require authentication.

**Independent Test**: Can be tested end-to-end by submitting the reset request form and then submitting the reset-complete form with a valid token.

**Acceptance Scenarios**:

1. **Given** a visitor on reset-request.html, **When** they enter any email and submit, **Then** the same success message is always shown regardless of whether the email is registered (anti-enumeration)
2. **Given** a visitor on reset-complete.html with a valid token in the URL, **When** they enter matching new and confirm passwords and submit, **Then** they are redirected to login.html on success
3. **Given** a visitor on reset-complete.html with an expired or invalid token, **When** they submit, **Then** a clear error message is shown explaining the token is invalid or expired
4. **Given** a visitor on login.html, **When** they view the page, **Then** a "Forgot password?" link to reset-request.html is visible
5. **Given** an already-authenticated user, **When** they navigate to reset-request.html or reset-complete.html, **Then** they may proceed — these pages have no auth requirement

---

### User Story 4 - User Profile Self-Service (Priority: P4)

An authenticated user navigates to their profile page to update their username, email address, or password via three independent form sections, each providing inline success or error feedback.

**Why this priority**: Self-service account management reduces admin burden. Each form section is independent, so partial implementation still delivers value.

**Independent Test**: Can be tested by loading profile.html as an authenticated user and submitting each of the three forms independently.

**Acceptance Scenarios**:

1. **Given** an authenticated user on profile.html, **When** they update their username and submit, **Then** a success message appears inline without a page reload
2. **Given** an authenticated user, **When** they submit a new email address, **Then** they see a notice that a confirmation email will be sent and their old email remains active until confirmed
3. **Given** an authenticated user, **When** they submit a password change with a correct current password and matching new/confirm fields, **Then** a success message appears inline
4. **Given** an authenticated user, **When** they submit a password change with an incorrect current password, **Then** an inline error message is displayed
5. **Given** an unauthenticated user, **When** they navigate to profile.html, **Then** they are redirected to login.html
6. **Given** an authenticated user on index.html, **When** they view the header navigation, **Then** a Profile link is visible

---

### User Story 5 - Admin Navigation Link (Priority: P5)

An admin user sees a conditional Admin Dashboard link in the main app header, visible only when the logged-in user holds the admin role.

**Why this priority**: Navigation entry points complete the admin feature surface. Dependent on the admin dashboard existing but trivially testable in isolation.

**Independent Test**: Can be tested by loading index.html as an admin versus a regular user and confirming the Admin Dashboard link appears or is absent accordingly.

**Acceptance Scenarios**:

1. **Given** an authenticated admin on index.html, **When** they view the header, **Then** an Admin Dashboard link is visible
2. **Given** an authenticated non-admin on index.html, **When** they view the header, **Then** no Admin Dashboard link is visible

---

### Edge Cases

- What happens when the admin attempts to delete the last remaining admin account? (Assumed blocked by backend; frontend shows the error message returned by the API)
- What happens when the password reset token in the URL is missing entirely? (reset-complete.html shows an immediate error indicating no token was found)
- What happens when a Create User request fails due to a duplicate username or email? (Inline error displayed in the modal without closing it)
- What happens when the audit log returns zero results matching applied filters? (Empty state message shown in the table)
- What happens when the user's role information is not yet available before the header navigation renders? (Admin link remains hidden until role is confirmed)

## Requirements *(mandatory)*

### Functional Requirements

**Password Reset**

- **FR-001**: The application MUST provide a publicly accessible page where any visitor can submit their email address to request a password reset link
- **FR-002**: The password reset request page MUST always display the same success message regardless of whether the submitted email is registered
- **FR-003**: The application MUST provide a publicly accessible page that reads a reset token from the URL and allows the user to set a new password
- **FR-004**: The password reset completion page MUST redirect to the login page on successful password change
- **FR-005**: The password reset completion page MUST display a clear error message when the reset token is expired or invalid
- **FR-006**: The login page MUST include a visible "Forgot password?" link to the reset-request page

**User Profile**

- **FR-007**: Authenticated users MUST be able to change their username from a dedicated profile page
- **FR-008**: Authenticated users MUST be able to change their email address, with a visible notice that the change requires email confirmation before taking effect
- **FR-009**: Authenticated users MUST be able to change their password by supplying their current password, a new password, and a confirmation of the new password
- **FR-010**: All profile form sections MUST show inline success and error feedback without triggering a full page reload
- **FR-011**: The main application header MUST include a Profile link visible to all authenticated users

**Admin Dashboard**

- **FR-012**: The admin dashboard MUST display a summary stats bar showing the total number of registered users and the number of users with an active session; both values are derived client-side from the user list response — total users equals the list length, active sessions equals the count of users where status is active and last login is recorded
- **FR-013**: The admin dashboard MUST display a user management table with columns: username, email, role, status, last login, and scheduled deletion date (scheduled deletion date shown only for deactivated users)
- **FR-014**: Each user row MUST provide contextually shown actions: deactivate (active users), reactivate (deactivated users), delete, change role, resend confirmation email
- **FR-015**: Destructive actions (delete, deactivate) MUST require confirmation via a dialog before executing
- **FR-016**: The admin dashboard MUST prevent admins from deactivating, deleting, or changing the role of their own account; these actions MUST be visually disabled with a tooltip explanation
- **FR-017**: The admin dashboard MUST include a Create User button that opens a modal form with username, email, and role fields; on success the new user row MUST appear in the table without a page reload
- **FR-018**: The admin dashboard MUST display a paginated audit log table (20 entries per page) with columns: timestamp, admin username (sourced from `actorUsername` in the audit log response), action type, target username (if applicable); the backend audit log response MUST include `actorUsername` as part of this iteration
- **FR-019**: The audit log MUST support filtering by date range (from/to date inputs) and by action type (dropdown)
- **FR-020**: The audit log MUST provide pagination controls showing previous, next, and current page indicator

**Auth Guard**

- **FR-021**: The reset-request and reset-complete pages MUST be publicly accessible — no authentication required
- **FR-022**: The profile page MUST require authentication; unauthenticated visitors MUST be redirected to login
- **FR-023**: The admin dashboard MUST require authentication AND the admin role; unauthenticated visitors MUST be redirected to login, authenticated non-admins MUST be redirected to the main app
- **FR-024**: The main application header MUST show the Admin Dashboard navigation link only to authenticated users with the admin role

**Build**

- **FR-025**: All new HTML pages MUST be registered as build entry points so they are included in production builds
- **FR-026**: Each new HTML page MUST have a corresponding TypeScript entry file that runs the auth guard as its first action before any page-specific logic

### Key Entities

- **User**: An account in the system with identity attributes (username, email), an access role (admin or standard user), a status (active, deactivated, or pending email confirmation), timestamps for creation and last login, and an optional scheduled deletion date that appears only when the account is deactivated
- **Audit Log Entry**: A recorded administrative action with a timestamp, the username of the admin who performed the action (`actorUsername` — resolved server-side via join), the type of action taken, and the target username (if the action was directed at a specific user)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five new pages (reset-request, reset-complete, profile, admin, and any navigation additions) are accessible to users with the appropriate role or access level — no page is reachable without meeting its access requirements
- **SC-002**: Every user-facing action in the admin dashboard (create, deactivate, reactivate, delete, change role, resend confirmation) completes without a full page reload and the table reflects the updated state immediately
- **SC-003**: The audit log correctly returns and displays filtered results; applying date or action-type filters changes the displayed entries to match only the filtered criteria
- **SC-004**: The password reset flow can be completed end-to-end by a user with a valid token — from submitting the reset request to successfully setting a new password and being redirected to login
- **SC-005**: All three profile self-service actions (username, email, password) succeed with visible inline feedback; no section causes a full page reload
- **SC-006**: A non-admin authenticated user attempting to access the admin dashboard is always redirected to the main app — the admin dashboard content is never rendered for non-admin users

## Assumptions

- Admin summary stats are derived client-side from the GET /api/admin/users response; no dedicated stats endpoint is needed or expected
- The audit log response includes `actorUsername` (resolved server-side); the backend AuditLogEntryDto will be amended in this iteration's polish phase to add this field — this is a backend change scoped to this iteration
- Confirmation dialogs are implemented using the browser's native `confirm()` dialog or a lightweight custom modal consistent with the existing UI; no third-party dialog library is introduced
- Role information for the currently authenticated user is accessible from the decoded access token already in memory — no additional API call is required to determine if the Admin Dashboard link should be shown
- All backend API endpoints referenced in the feature description match the contracts already implemented in the existing api-client.ts; any discrepancy is resolved during planning by deferring to the existing api-client.ts function signatures
- The "pending confirmation" user status is derived from the combination of `isActive` and `emailConfirmed` fields already present in the AdminUserDto
