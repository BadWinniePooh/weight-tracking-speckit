# Feature Specification: PWA Support

**Feature Branch**: `015-pwa-support`
**Created**: 2026-03-18
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install App on Android (Priority: P1)

A user visiting the weight tracker in Chrome on Android sees a browser prompt (or banner) offering to add the app to their home screen. They accept, and the app installs. When they open it from the home screen, it launches in a standalone window — no browser chrome — just like a native app.

**Why this priority**: This is the core goal of the feature. Without this working, nothing else matters.

**Independent Test**: Navigate to the app in Chrome on Android (or use Chrome DevTools mobile emulation), verify the browser offers an install option, install it, and confirm it opens in standalone mode without a browser address bar.

**Acceptance Scenarios**:

1. **Given** a user visits the app in a supported browser, **When** the app meets all installability requirements, **Then** the browser displays an install prompt or "Add to Home Screen" option.
2. **Given** the user has installed the app, **When** they launch it from the home screen, **Then** it opens in standalone mode with no browser navigation bar.
3. **Given** the app is installed, **When** a new version is deployed, **Then** the app reflects the updated content on next launch without manual cache clearing.

---

### User Story 2 - Install App on Desktop (Priority: P2)

A user visiting the weight tracker in Chrome or Edge on desktop sees an install icon in the browser address bar. They click it and install the app, which then opens in its own window separate from the browser.

**Why this priority**: Bonus goal from the requirements; same mechanism as Android, just a different platform.

**Independent Test**: Open the app in Chrome on desktop, verify the install icon appears in the address bar, install it, and confirm it opens in a standalone app window.

**Acceptance Scenarios**:

1. **Given** a user visits the app in a supporting desktop browser, **When** installability criteria are met, **Then** an install option appears in the browser UI.
2. **Given** the app is installed on desktop, **When** opened, **Then** it launches in its own window without browser navigation.

---

### User Story 3 - Add to Home Screen on iOS (Priority: P3)

A user on iOS using Safari can manually tap "Share → Add to Home Screen" and add the weight tracker to their home screen. The app opens in a standalone-like experience.

**Why this priority**: iOS does not support the automatic install prompt — it requires a manual flow. Full parity with Android is not achievable, but basic support is a nice-to-have.

**Independent Test**: Open the app in Safari on iOS, use the Share menu to add to home screen, confirm the app opens with appropriate icon and name.

**Acceptance Scenarios**:

1. **Given** a user on iOS taps "Add to Home Screen" via Share, **When** the app has a valid manifest with icons, **Then** it appears on the home screen with the correct name and icon.
2. **Given** the app is launched from the iOS home screen, **When** it opens, **Then** it displays without the Safari browser chrome.

---

### Edge Cases

- What happens if the user dismisses the install prompt — is it re-shown on a future visit?
- What happens if the user is on a browser that does not support PWA installation (e.g., Firefox on Android)? The app must still work normally.
- What happens if the service worker fails to load (e.g., network error)? The app must still load and function normally.
- What happens when the user clears browser storage? They should not see broken state — the app should reload cleanly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST be identifiable by the browser as installable, satisfying all platform installability requirements without requiring any user-side configuration.
- **FR-002**: The application MUST provide a proper identity for installation: a display name, a short name, and a unique icon at minimum two standard sizes (small and large).
- **FR-003**: The application MUST launch in standalone display mode when opened from the home screen or desktop, hiding browser navigation controls.
- **FR-004**: The application MUST register a background asset manager that enables the browser to cache and serve application files efficiently.
- **FR-005**: The asset cache MUST be automatically invalidated and refreshed when a new version of the application is deployed, so users always receive up-to-date content.
- **FR-006**: The application MUST continue to function normally in all browsers regardless of whether PWA installation is supported.
- **FR-007**: The install prompt MUST appear via standard browser heuristics; no custom in-app install button or UI is required.
- **FR-008**: All existing application pages MUST declare the app identity so any entry point supports installation.

### Assumptions

- The app is always served over HTTPS in production (already satisfied by Traefik).
- Offline support is explicitly out of scope; the background asset manager need only satisfy installability, not full offline operation.
- A simple, purpose-made icon is acceptable; a professionally designed icon is not required at this stage.
- Push notifications and background sync are out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Chrome on Android presents an install option when a user visits the app, with zero additional configuration required by the user.
- **SC-002**: The installed app opens in standalone mode (no browser address bar visible) 100% of the time when launched from the home screen.
- **SC-003**: After a new version is deployed, all users see the updated content within one app restart — no manual cache clearing required.
- **SC-004**: The app passes all browser installability checks with zero reported errors (verifiable via browser developer tools).
- **SC-005**: The app loads and operates normally in browsers that do not support PWA installation, with no degraded experience.
- **SC-006**: Build output includes a valid app manifest and a registered service worker file, verifiable by automated checks.
