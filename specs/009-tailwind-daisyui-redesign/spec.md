# Feature Specification: Tailwind CSS + DaisyUI UI Redesign

**Feature Branch**: `009-tailwind-daisyui-redesign`
**Created**: 2026-03-16
**Status**: Draft
**Input**: Design sprint — replace hand-written CSS with Tailwind CSS + DaisyUI across all pages. Modern, colorful, responsive UI with OS dark/light mode preference. No backend changes. Styling redesign plus targeted bug fixes (stats bar live refresh, modal centering, audit log datetime format, email change notice).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent Visual Identity Across All Pages (Priority: P1)

A user opens the app on any page and sees a cohesive, polished visual design. All pages share the same color palette, typography, spacing, and component styles. The experience feels like a unified product, not a collection of individually styled pages. The design is appropriate for a personal health and fitness context — energetic but not clinical.

**Why this priority**: Visual cohesion is the core deliverable of this sprint. Without it, nothing else matters. Broken or inconsistent styling would make the app feel untrustworthy for a health tracking context.

**Independent Test**: Can be fully tested by loading each page in a browser and visually verifying consistent colors, fonts, spacing, and component appearance. Automated tests can verify all pages reference shared style tokens.

**Acceptance Scenarios**:

1. **Given** a user loads login.html, **When** they compare its visual appearance to index.html, **Then** both pages use the same color palette, font family, and spacing scale.
2. **Given** a user loads any page, **When** they inspect buttons, inputs, and cards, **Then** all interactive elements have consistent appearance, hover states, and focus outlines.
3. **Given** the design system documentation exists at docs/design-system.md, **When** a developer reads it, **Then** it fully documents all color choices, typography decisions, and component usage guidelines with rationale.

---

### User Story 2 - Persistent Responsive Navigation on Authenticated Pages (Priority: P1)

An authenticated user navigating between the dashboard (index), profile, and admin pages always sees a persistent navbar. On desktop, the navbar is a horizontal bar at the top. On mobile (below ~768px), the navbar collapses to a hamburger menu that expands to show all navigation items. The navbar always shows the user's current page as active/highlighted. Admin-only links (Admin Dashboard) appear only for admin-role users. A logout button is always visible.

**Why this priority**: Navigation is essential infrastructure for authenticated pages. Without it, users cannot move between pages. It also satisfies the role-based visibility requirement (admin-only links) which is a security-adjacent concern.

**Independent Test**: Can be fully tested on a single authenticated page by resizing the viewport between 320px and 1280px, verifying navbar behavior, active state, and role-based link visibility.

**Acceptance Scenarios**:

1. **Given** an authenticated user is on index.html, **When** they view the top of the page on a desktop viewport, **Then** a horizontal navbar is visible with links to Dashboard, Profile, and (if admin) Admin Dashboard, plus a Logout button, with Dashboard highlighted as active.
2. **Given** an authenticated user is on a mobile viewport (≤ 767px), **When** the page loads, **Then** the navbar shows a hamburger icon; when the user taps it, all navigation items expand and are fully accessible.
3. **Given** a standard (non-admin) user is authenticated, **When** they view the navbar, **Then** the Admin Dashboard link is not present.
4. **Given** an admin user is authenticated, **When** they view the navbar, **Then** the Admin Dashboard link is visible and navigates to admin.html.
5. **Given** an authenticated user clicks Logout, **When** the action completes, **Then** the user is redirected to login.html and the session is cleared (same behavior as today).

---

### User Story 3 - OS Dark/Light Mode Preference Respected (Priority: P2)

A user whose operating system is set to dark mode sees the app in a dark color scheme automatically, without any manual toggle. A user in light mode sees the light scheme. The transition requires no user action. Both themes are visually complete and readable — no unthemed elements, unreadable contrast, or broken layouts in either mode.

**Why this priority**: Dark mode is a strong accessibility and comfort preference for many users. Automatic respect for system settings is the modern baseline expectation. Not supporting it would feel dated.

**Independent Test**: Can be fully tested by toggling the OS/browser dark mode preference and visually verifying every page renders correctly in both states.

**Acceptance Scenarios**:

1. **Given** a user's OS is set to dark mode, **When** they open any page of the app, **Then** the entire page renders in a dark color scheme with legible text and sufficient contrast.
2. **Given** a user's OS is set to light mode, **When** they open any page, **Then** the page renders in a light color scheme.
3. **Given** a user switches their OS preference while the app is open, **When** the preference change is applied, **Then** the app updates its color scheme without requiring a page reload.
4. **Given** either theme is active, **When** a user inspects all interactive elements (buttons, inputs, cards, tables, badges, modals), **Then** all elements are fully styled with no unstyled/defaulted appearance.

---

### User Story 4 - Centered Card Layout for Public (Unauthenticated) Pages (Priority: P2)

A user who arrives at a public page (login, first-run setup, password reset request, password reset completion) sees a clean, minimal layout centered on the screen. There is no navigation bar — just a focused card containing the relevant form. The layout adapts to all screen sizes from mobile to desktop.

**Why this priority**: Public pages are the first impression for new and returning users. A focused card layout is a well-established pattern for authentication flows. It avoids the complexity of navigation while keeping the visual language consistent with the rest of the app.

**Independent Test**: Load each of the four public pages at 320px and 1280px viewport widths and verify the centered card renders correctly with no navbar present.

**Acceptance Scenarios**:

1. **Given** a user navigates to login.html, **When** the page loads, **Then** a centered card is displayed with username and password fields, a submit button, and a "Forgot password?" link. No navbar is present.
2. **Given** a user navigates to setup.html (first-run wizard), **When** the page loads, **Then** a centered card is displayed with the setup form. No navbar is present.
3. **Given** a user navigates to reset-request.html, **When** the page loads, **Then** a centered card with an email input form is displayed. No navbar is present.
4. **Given** a user navigates to reset-complete.html, **When** the page loads, **Then** a centered card with a new password form is displayed. No navbar is present.
5. **Given** any public page, **When** viewed at 320px width, **Then** the card fits within the viewport with appropriate padding and no horizontal scroll.

---

### User Story 5 - Rich Interactive Feedback (Priority: P2)

Users receive clear, styled visual feedback for every interaction with the app — including hover and focus states on interactive elements, inline error messages when form validation fails, confirmation dialogs for destructive actions, and loading indicators during API calls. No interaction leaves the user uncertain about what happened or what to do next.

**Why this priority**: Interactive states are what elevate a "designed" page from a "styled" one. They communicate system state clearly, reducing errors and frustration. Form errors and destructive confirmation dialogs are specifically important for a health data app where accidental data deletion or incorrect entries matter.

**Independent Test**: Can be tested on index.html alone by submitting an empty form (to trigger errors), performing an action that triggers a confirmation dialog, and observing button loading states.

**Acceptance Scenarios**:

1. **Given** a user submits a form with invalid or missing data, **When** validation fails, **Then** error messages appear inline below the relevant field, styled distinctly from normal text (e.g., red/error-colored alert).
2. **Given** a user initiates a destructive action (e.g., deactivating a user in admin), **When** the action is triggered, **Then** a modal confirmation dialog appears requiring explicit confirmation before proceeding.
3. **Given** a user submits a form or triggers an API call, **When** the request is in flight, **Then** the submit button shows a visual loading state (spinner or disabled state) and is non-interactive until the call completes.
4. **Given** any interactive element (button, input, link), **When** the user hovers or focuses it, **Then** a visually distinct hover/focus state is shown (outline, background color change, etc.).
5. **Given** a user submits an email change on the profile page, **When** the confirmation notice appears, **Then** it displays the actual new email address entered (e.g., "A confirmation email has been sent to john@example.com") — not the generic "sent to your new address".

---

### User Story 6 - Admin Page: Styled Stats, User Table, and Audit Log (Priority: P3)

An admin user visiting admin.html sees a fully styled page with three distinct sections: a stats bar showing key metrics, a user management table with role-based action buttons and status badges, and an audit log table with filtering and pagination controls. Tables use zebra striping. Status badges use color-coded badges (active = green/success, deactivated = red/error, pending = yellow/warning).

**Why this priority**: Admin pages are used less frequently than the main dashboard, but they must work correctly and be visually complete. This is lower priority than core navigation and auth flows.

**Independent Test**: Can be tested by loading admin.html as an admin user and verifying all three sections render with correct styling, zebra-striped tables, and color-coded badges.

**Acceptance Scenarios**:

1. **Given** an admin user views admin.html, **When** the page loads, **Then** a stats bar displays user count and session statistics with clear visual separation from the rest of the page.
2. **Given** user records with varying statuses exist, **When** the user table renders, **Then** each row shows a colored badge: active (green), deactivated (red), pending email confirmation (yellow).
3. **Given** the user table is rendered, **When** a user inspects the rows, **Then** rows alternate background colors (zebra striping) for readability.
4. **Given** the audit log section is rendered, **When** a user applies a filter or navigates pagination, **Then** the displayed records update to match the filter/page (same functional behavior as today, with styled controls).
5. **Given** an admin performs any mutating action (create user, delete user, deactivate user, reactivate user), **When** the action completes, **Then** the stats bar updates in-place without a full page reload, reflecting the new total user count and active session count.
6. **Given** an admin opens the Create User dialog, **When** the modal renders, **Then** it is centered on screen using DaisyUI `modal` and `modal-box` classes — not positioned at the top-left corner.
7. **Given** the audit log table is rendered, **When** a user inspects the timestamp column, **Then** each entry displays the full date and time formatted as `YYYY-MM-DD HH:mm` in the user's local timezone (not date only).

---

### User Story 7 - Test Stability: Stable DOM Identifiers Independent of Styling (Priority: P1)

Every interactive HTML element in the app has a unique `id` or `data-action` attribute that is stable and independent of CSS styling. All existing frontend tests are refactored to query the DOM exclusively via these stable identifiers (id, data-*, ARIA roles) — never by CSS class names. Tests pass before any styling changes are applied.

**Why this priority**: P1 because this is a non-negotiable prerequisite. Failing to refactor tests first means styling changes will break tests, making the refactor impossible to verify. Stable identifiers also protect tests from future styling iterations.

**Independent Test**: Run the full frontend test suite after only the identifier refactor (before any HTML/CSS changes). All tests must pass.

**Acceptance Scenarios**:

1. **Given** the current test suite, **When** all CSS class-based DOM queries are identified, **Then** each is replaced with a query using an id, data-* attribute, or ARIA role before any HTML styling changes are made.
2. **Given** the refactored test suite, **When** tests are run against the unchanged HTML, **Then** all tests pass.
3. **Given** any interactive element in any HTML page, **When** the element is inspected, **Then** it has a unique `id` or `data-action` attribute that would remain valid even if all CSS classes were changed.

---

### Edge Cases

- What happens when the app is loaded on a viewport narrower than 320px? (The design need not support sub-320px but must not break — graceful degradation is acceptable.)
- How does the hamburger menu behave when JavaScript is disabled? (Acceptable to require JavaScript for navigation, as the current app already requires JS throughout.)
- What happens if the user's OS/browser does not support the `prefers-color-scheme` media query? (Default to light theme.)
- What happens when a user's role changes during an active session and they navigate between pages? (Role-based navbar links reflect the role encoded in the active session token — same behavior as today.)
- What happens when a form input is in an error state and the user corrects it? (Error message clears on valid input or re-submission.)

## Requirements *(mandatory)*

### Functional Requirements

**Navigation & Layout**

- **FR-001**: All authenticated pages (index, profile, admin) MUST include a persistent navbar component with links appropriate to the authenticated user's role.
- **FR-002**: The navbar MUST display navigation items based on role: Profile link visible to all authenticated users; Admin Dashboard link visible only to admin-role users.
- **FR-003**: The navbar MUST always show a Logout button for authenticated users, functioning identically to the current logout behavior.
- **FR-004**: The navbar MUST visually highlight the currently active page so the user always knows where they are.
- **FR-005**: On mobile viewports (≤ 767px), the navbar MUST collapse to a hamburger icon that expands to reveal all navigation items on interaction.
- **FR-006**: On desktop viewports (≥ 768px), the navbar MUST render as a horizontal top bar.
- **FR-007**: All public pages (login, setup, reset-request, reset-complete) MUST use a minimal centered-card layout with no navbar present.

**Visual Design & Theming**

- **FR-008**: The application MUST automatically apply a dark color scheme when the user's OS is set to dark mode, and a light color scheme when set to light mode.
- **FR-009**: Both dark and light themes MUST be fully complete — no page, section, or component may appear unstyled or use default browser styling.
- **FR-010**: The visual design MUST be appropriate for a personal health and fitness tracking application — colorful, modern, and approachable without being clinical.
- **FR-011**: All pages MUST be responsive across viewport widths from 320px to 1280px with no horizontal scrolling or broken layouts.

**Interactive States**

- **FR-012**: All interactive elements (buttons, inputs, links, selects) MUST have visually distinct hover and focus states.
- **FR-013**: Disabled interactive elements MUST be visually distinct from their enabled state.
- **FR-014**: Form validation errors MUST be displayed inline adjacent to the relevant input field, using a visually distinct error style.
- **FR-015**: Any action that is destructive or irreversible MUST present a modal confirmation dialog before proceeding.
- **FR-016**: During API calls, the triggering button or form MUST enter a visual loading state (disabled + spinner or equivalent) until the call resolves.

**Component Styling**

- **FR-017**: All data tables (user management table, audit log table, weight history table) MUST use zebra-striped rows for readability.
- **FR-018**: User status indicators (active, deactivated, pending email confirmation) MUST be rendered as color-coded badges: active = success/green, deactivated = error/red, pending = warning/yellow.

**Stability & Functional Preservation**

- **FR-019**: Every interactive HTML element MUST have a unique `id` or `data-action` attribute that is independent of its CSS styling and stable across future style changes.
- **FR-020**: All existing frontend tests MUST be refactored to query DOM elements exclusively via `id`, `data-*` attributes, or ARIA roles — never by CSS class names — before any HTML styling changes are introduced.
- **FR-021**: All existing functional behaviors MUST be preserved exactly — this sprint is a styling redesign plus targeted bug fixes. No changes to application logic, API calls, routing, or data handling are permitted except where explicitly required by FR-028 through FR-031.
- **FR-022**: No backend changes are permitted in this sprint.

**Design System Documentation**

- **FR-023**: A design system document MUST be created at `docs/design-system.md` documenting: color palette (primary, secondary, accent, neutral, base — for both themes), typography scale and font choices, component usage guidelines, spacing and layout conventions, icon usage, and rationale for all major design decisions.
- **FR-024**: The `docs/design-system.md` document MUST be the single source of truth for UI decisions and MUST be kept up to date in future iterations.

**Technology Constraints**

- **FR-025**: Tailwind CSS v3 and DaisyUI v4 MUST be added as development dependencies to the frontend build.
- **FR-026**: Theme switching MUST be implemented using DaisyUI's theme system driven by the `prefers-color-scheme` media query — no manual toggle, no localStorage persistence.
- **FR-027**: All hand-written CSS that duplicates functionality available via Tailwind/DaisyUI MUST be removed. Only custom CSS with no Tailwind/DaisyUI equivalent may be retained.

**Bug Fixes**

- **FR-028**: After any admin action that mutates user state (create, delete, deactivate, reactivate), the stats bar MUST update in-place without a full page reload. The implementation MUST re-fetch the user list after each mutation and recalculate total users and active sessions from the refreshed data.
- **FR-029**: The Create User dialog MUST be centered on screen using DaisyUI `modal` and `modal-box` classes. The current top-left positioning MUST be replaced.
- **FR-030**: The audit log timestamp column MUST display the full date and time formatted as `YYYY-MM-DD HH:mm` in the user's local timezone. Date-only display is not acceptable.
- **FR-031**: The confirmation notice shown after a user submits an email change on the profile page MUST include the actual new email address entered (e.g., "A confirmation email has been sent to john@example.com"). Generic placeholder text ("sent to your new address") MUST be replaced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 7 pages (login, setup, reset-request, reset-complete, index, profile, admin) render without unstyled/default-browser-styled content in both dark and light mode.
- **SC-002**: The full frontend test suite passes after the stable-identifier refactor and again after all styling changes, with zero regressions.
- **SC-003**: All pages render without horizontal scrolling or layout breakage at 320px, 768px, and 1280px viewport widths.
- **SC-004**: Every interactive element on every page has at least one stable identifier (id or data-* attribute) that is not a CSS class name.
- **SC-005**: Dark mode is active when the OS/browser `prefers-color-scheme` is `dark`; light mode is active otherwise. This is verifiable by toggling the OS preference.
- **SC-006**: The `docs/design-system.md` document exists and covers all required sections (palette, typography, components, spacing, icons, rationale) with sufficient detail for a future developer to extend the design consistently.
- **SC-007**: The navbar renders correctly at all viewport widths: horizontal bar at ≥ 768px, hamburger at < 768px, with correct role-based link visibility for both admin and standard users.
- **SC-008**: No existing API calls, routing behavior, or data operations are altered by this sprint — verified by running the full test suite against the redesigned frontend.
- **SC-009**: After each admin mutation (create/delete/deactivate/reactivate), the stats bar reflects updated counts without a page reload.
- **SC-010**: The Create User dialog is centered on screen in all supported viewport widths.
- **SC-011**: Every audit log timestamp displays `YYYY-MM-DD HH:mm` in the user's local timezone.
- **SC-012**: The email change confirmation notice on the profile page displays the actual email address entered by the user.

## Assumptions

- The existing frontend test suite provides meaningful coverage of all interactive behaviors; identifying CSS class queries in tests is tractable.
- Font choices will be Google Fonts or system fonts — no paid font licensing required.
- The DaisyUI `light` and `dark` built-in themes will be used as the starting point and customized with the chosen health/fitness color palette, rather than building fully custom themes from scratch.
- Icon usage is optional; if icons are used, they will be sourced from a free, CDN-compatible library (e.g., Heroicons as inline SVGs) without introducing new npm dependencies.
- The hamburger menu toggle will be implemented in vanilla TypeScript/JavaScript — no external menu library is required given DaisyUI's built-in drawer/navbar components.
- The chart (Chart.js) on index.html will retain its current library and configuration; only the surrounding HTML/CSS wrapper is restyled.
- "Pending email confirmation" is an existing status that already has a visual representation; this sprint only changes how that status is visually rendered (badge style), not the logic that determines it.

## Clarifications

### Session 2026-03-16

- Q: Should FR-021 be amended to carve out the 4 bug fixes, or should the sprint scope statement be updated to "styling redesign plus targeted bug fixes"? → A: Update sprint scope statement and FR-021 to "styling redesign plus targeted bug fixes" (Option B).
- Q: (User input) Stats bar live refresh — after any admin action that mutates user state (create, delete, deactivate, reactivate), re-fetch user list and recalculate stats in-place. → A: Added as FR-028 and SC-009.
- Q: (User input) Create User modal centering — use DaisyUI `modal` and `modal-box` classes; fix current top-left positioning. → A: Added as FR-029 and SC-010.
- Q: (User input) Audit log full datetime display — format `YYYY-MM-DD HH:mm` in user's local timezone. → A: Added as FR-030 and SC-011.
- Q: (User input) Email change notice includes actual address — show "A confirmation email has been sent to <email>" not generic text. → A: Added as FR-031 and SC-012.
