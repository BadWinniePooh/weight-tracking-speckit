# Feature Specification: Offline-First PWA, Foldable History, Week-Long Sessions

**Feature Branch**: `018-offline-first-pwa`
**Created**: 2026-07-30
**Status**: Draft
**Input**: User description: "Make the History card on the main page foldable (default
folded). Extend the PWA to be offline-first: users must be able to add weight and see
graph updates offline, with automatic synchronization on reconnect and no user
interaction. Authentication may only work online, but a successful authentication must
keep the user signed in for at least one week before automatic logout."

## Clarifications

### Session 2026-07-30

- Q: Which operations must work offline? → A: **Everything** on the main page — add,
  delete, delete-all, and export.
- Q: How should sync resolve overlapping offline data from two devices? → A: **Append
  everything.** Entries are point-in-time measurements; all offline entries coexist.
  Duplicates are prevented per-entry by client-generated ids, never by comparing values.
- Q: Is the one-week session fixed from login or sliding? → A: **Sliding** — each
  successful token refresh extends the session another 7 days. Logout happens only
  after 7 days without use.
- Q: What happens when the app is opened offline by a recently signed-in user? → A:
  **Open straight into the app** using a locally persisted marker of the last
  successful auth (an expiry date, not the token). Past 7 days → login page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log Weight While Offline (Priority: P1)

A signed-in user opens the app with no connectivity — airplane mode, dead spot, server
down. The app opens normally, shows their history and chart from the last known state,
and lets them log a weight entry. The chart and history update immediately. When
connectivity returns, the entry reaches the server automatically without the user
doing anything.

**Why this priority**: This is the stated core of the feature. A weight is measured at
a moment in time; if it can't be captured at that moment, the data is lost.

**Independent Test**: Load the app online once, go offline (DevTools network toggle),
reload, add an entry, verify chart and history update; go online, verify the entry
appears on the server exactly once.

**Acceptance Scenarios**:

1. **Given** a user who has used the app online before, **When** they open it with no
   network, **Then** the app loads and renders their cached entries and chart.
2. **Given** the app is open offline, **When** the user logs a valid weight, **Then**
   the entry appears in the history and the chart re-renders — with no error shown.
3. **Given** offline entries are pending, **When** connectivity returns while the app
   is open, **Then** the entries are uploaded automatically with no user interaction.
4. **Given** a pending entry was uploaded, **When** the same upload is retried (flaky
   network double-send), **Then** the server stores the entry exactly once.
5. **Given** two devices logged entries offline on the same account, **When** both
   sync, **Then** all entries from both devices coexist on the server.

---

### User Story 2 - Full Main-Page Function Offline (Priority: P2)

Beyond adding entries, the user can delete a single entry, delete all entries, and
export their data while offline. Deletes are applied locally at once and propagate to
the server on reconnect. Export produces a file from the locally known data.

**Why this priority**: Users shouldn't need to reason about which buttons work
offline; the whole main page behaves the same.

**Acceptance Scenarios**:

1. **Given** the app is offline, **When** the user deletes an entry, **Then** it
   disappears from history and chart immediately, and is deleted on the server after
   reconnect.
2. **Given** the app is offline, **When** the user deletes all entries, **Then** the
   local list empties, and on reconnect every entry *this client had seen* is deleted
   on the server. Entries created meanwhile on another device survive (append-everything
   policy).
3. **Given** the app is offline, **When** the user deletes an entry that was itself
   created offline and never synced, **Then** nothing is ever sent to the server for
   that entry.
4. **Given** the app is offline, **When** the user exports CSV or JSON, **Then** the
   download contains the locally known entries.

---

### User Story 3 - Stay Signed In for a Week (Priority: P2)

Authentication requires connectivity. But once a user has signed in, they stay signed
in for at least one week of inactivity, sliding: any use that reaches the server
extends the window another week. Opening the app offline within the window works;
opening it after the window shows the login page.

**Acceptance Scenarios**:

1. **Given** a user signed in 6 days ago and has not used the app since, **When** they
   open it (online or offline), **Then** they are still signed in.
2. **Given** a user last reached the server 8 days ago, **When** they open the app,
   **Then** they are shown the login page (offline: because the local marker is
   expired; online: because the server refresh token is expired).
3. **Given** a user uses the app online today, **When** the session is checked 6 days
   later, **Then** it is still valid (the window slid forward on use).
4. **Given** the app is offline, **When** the user tries to log in, **Then** login
   fails with a clear message — authentication is online-only.

---

### User Story 4 - Foldable History (Priority: P3)

The History card on the main page is collapsed by default on every load. Expanding it
shows the existing entry table unchanged.

**Acceptance Scenarios**:

1. **Given** the main page loads, **When** the user looks at the History card, **Then**
   its body (the entry table) is hidden and only the "History" title with a fold
   indicator is visible.
2. **Given** the History card is folded, **When** the user taps its title, **Then**
   the entry table expands; tapping again folds it.
3. **Given** the history was expanded, **When** the page reloads, **Then** it is
   folded again (no persistence).

---

### Edge Cases

- **First visit ever while offline**: unsupported by design. The app shell, the auth
  marker, and the data cache all require one prior online session. The browser shows
  its standard offline error.
- **Offline reload loses the in-memory access token**: acceptable — offline operation
  never calls the API; the queue is replayed after the next successful online refresh.
- **Flaky reconnect during token rotation**: the server rotates the refresh token on
  every refresh. If the response is lost after the server revoked the old token, the
  client would be logged out through no fault of its own. A short server-side grace
  window (60 s) on the revoked token absorbs this.
- **Sync interrupted mid-queue**: remaining operations stay queued; the next trigger
  (app load, online event) resumes from where it stopped. Replays are harmless because
  entry creation is idempotent by id.
- **Server rejects a queued create** (validation, 4xx): the operation is dropped so the
  queue cannot wedge; remaining operations continue.
- **Clearing browser storage while offline**: pending entries are lost with the rest of
  local state — same trust model as any offline-capable app.

## Requirements *(mandatory)*

### Functional Requirements

**Offline data**

- **FR-001**: The app MUST persist entries, chart settings, and a pending-operation
  queue locally, namespaced per user id, in storage keys that do not collide with the
  legacy migration keys (`weight_tracker_*`).
- **FR-002**: New entries MUST get a client-generated UUID at creation time, online and
  offline alike, so replays and cross-device syncs deduplicate by id.
- **FR-003**: While offline, add, delete, and delete-all MUST apply to the local state
  immediately and enqueue operations for later replay; export MUST generate from local
  state.
- **FR-004**: Offline delete-all MUST tombstone only the entry ids this client has
  seen; it MUST NOT delete server entries the client never knew about.
- **FR-005**: Deleting a locally created, never-synced entry MUST cancel its pending
  create rather than enqueue a delete.
- **FR-006**: The chart MUST be computed client-side from local entries and settings so
  it updates identically online and offline.

**Sync**

- **FR-007**: Sync MUST run automatically — on app load once authenticated, and on the
  browser's `online` event — with no user interaction.
- **FR-008**: Queued operations MUST replay in FIFO order; a network failure stops the
  run and preserves the remaining queue; HTTP 404 on a delete and HTTP 4xx on a create
  drop that operation and continue.
- **FR-009**: After the queue drains, the client MUST refresh its caches from the
  server and re-render.
- **FR-010**: Sync MUST be single-flight per tab — concurrent triggers must not
  interleave replays.

**Auth**

- **FR-011**: Authentication (login, token refresh) works only online; the login page
  MUST show a clear failure message when unreachable.
- **FR-012**: A successful login or token refresh MUST persist a local auth marker
  containing the user id, role, and a refresh-expiry timestamp 7 days out — never the
  token itself.
- **FR-013**: Opening the app offline with a valid marker MUST enter the app in
  offline mode; with an expired or absent marker it MUST redirect to the login page.
- **FR-014**: Logout and any rejected (401) refresh MUST clear the marker.
- **FR-015**: The server-side session MUST slide: each refresh extends the refresh
  token another 7 days (already the case; the 7-day constant is deduplicated, not
  changed).
- **FR-016**: The server MUST honour a refresh token for 60 seconds after it was
  rotated, so a client that lost the rotation response is not logged out.

**Backend correctness**

- **FR-017**: Creating an entry whose id already exists MUST return the existing entry
  with HTTP 200 when it belongs to the caller, and HTTP 409 with no entry data when it
  belongs to another user. Fresh inserts keep returning 201.

**UI**

- **FR-018**: The History card MUST render collapsed by default on every page load,
  expandable and collapsible by the user, with no persistence of the fold state.
- **FR-019**: The fold wrapper MUST NOT change the `#entry-list` container contract:
  `#entry-list` remains the direct parent of the rendered entry table, and all
  `data-cell` / `data-action` attributes from the 009 contract are unchanged.

**PWA**

- **FR-020**: The service worker MUST precache the application shell (all HTML pages,
  JS, CSS, icons, manifest) so the app opens with no network.
- **FR-021**: `/config.json` MUST be served network-first with cached fallback (it is
  generated at container start and cannot be precached at build time); additionally the
  parsed config MUST be cached in local storage as a second fallback.
- **FR-022**: API requests MUST never be cached or served by the service worker.

### Key Entities

- **Auth Marker**: `{ userId, role, refreshExpiresAt }` in local storage. Grants
  nothing server-side — it only gates the local UI shell; all data access requires the
  real HTTP-only cookie once online.
- **Pending Operation**: `{ type: "create", entry } | { type: "delete", id }` in a
  per-user FIFO queue.
- **Entry Cache**: last known server state per user, overlaid with pending operations
  for display.

## Success Criteria *(mandatory)*

- **SC-001**: With the network disabled after one online session, the app opens, shows
  history and chart, accepts a new entry, and updates the chart — zero errors surfaced.
- **SC-002**: Entries logged offline appear on the server exactly once after
  reconnect, with no user action.
- **SC-003**: All four main-page actions (add, delete, delete-all, export) complete
  offline.
- **SC-004**: A user inactive for 6 days remains signed in; a user inactive for 8 days
  is logged out — both offline (marker) and online (server token).
- **SC-005**: A replayed create with a foreign entry id returns 409 and leaks no data.
- **SC-006**: The History card is collapsed on load in the built app; expanding it
  shows the unchanged entry table; all existing entry-table tests pass unmodified.
- **SC-007**: The full CI gate suite passes; the mutation score does not regress below
  the 49.4% baseline.

## Assumptions

- One prior online session is required before offline capability exists (shell
  precache + marker + data cache). First-ever visit offline is out of scope.
- localStorage (namespaced) is sufficient as the offline store at this data volume
  (~decades of daily entries fit comfortably); IndexedDB is deliberately not
  introduced (YAGNI).
- Background Sync API is not used: it is unsupported on iOS Safari and sync-on-open
  plus the `online` event covers the requirement. Sync runs only while the app is open.
- The 60-second rotation grace window is an accepted, documented weakening of refresh
  replay protection, traded for session survival on flaky reconnects.
- The `/api/chart` endpoint remains for other consumers; the main page stops calling
  it in favour of the existing client-side calculation module.
