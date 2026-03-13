# Quickstart: Minimal Weight Tracker

**Date**: 2026-03-13
**Branch**: `001-weight-tracker-app`

Use this guide to build, run, and manually verify the app at each user story checkpoint.

---

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Docker (for container deployment verification)

---

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Development Server

```bash
npm run dev
```

Open `http://localhost:5173` in a browser. Changes to `.ts` and `.css` files
hot-reload automatically.

---

## 3. Run Tests

```bash
npm test
```

All tests must pass before implementation of any user story is considered complete.
To run in watch mode:

```bash
npm run test:watch
```

---

## 4. Production Build

```bash
npm run build
```

Output is written to `dist/`. The directory contains only static files:
`index.html`, `main.css`, and `bundle.js` (or equivalent Vite output names).

---

## 5. Docker Build and Run

```bash
# Build the container image
docker build -t weight-tracker .

# Run the container (serves on port 8080)
docker run --rm -p 8080:80 weight-tracker
```

Open `http://localhost:8080` to verify the app loads from the container.

---

## 6. Manual Validation Checklist

Work through each user story in order. Each checkpoint must pass before moving on.

### Checkpoint 1 — User Story 1: Log a Weight Entry (MVP)

1. Open the app in a browser.
2. Enter a valid weight value (e.g., `82.5`) and submit.
   - **Expected**: Entry appears at the top of the list with the current timestamp.
3. Refresh the page.
   - **Expected**: The entry is still present (localStorage persistence confirmed).
4. Submit an empty form.
   - **Expected**: Error message shown; no entry added.
5. Submit `0`, `-1`, and `9999` (above max).
   - **Expected**: Each is rejected with a clear error message; no entry added.

**Story 1 complete when**: All five checks pass.

---

### Checkpoint 2 — User Story 2: View Entry History

1. Log three entries (different weights).
   - **Expected**: All three appear in the list, newest first.
2. Verify each row shows the weight value, unit, date, and time.
3. Clear all entries from localStorage manually (DevTools → Application → Local Storage →
   delete `weight_tracker_entries`), then reload.
   - **Expected**: Empty-state message is shown ("No entries yet").

**Story 2 complete when**: All three checks pass.

---

### Checkpoint 3 — User Story 3: Delete an Entry

1. Log two entries (A and B, A logged first, B logged second).
2. Delete entry B (the top/newest one).
   - Cancel the confirmation first — **Expected**: B is still present.
   - Then confirm deletion — **Expected**: B is removed; only A remains.
3. Refresh the page.
   - **Expected**: Only A remains (deletion persisted).
4. Delete the last remaining entry (A).
   - **Expected**: Empty-state message is shown.

**Story 3 complete when**: All four steps produce the expected result.

---

### Checkpoint 4 — Unit Preference

1. Change the unit preference to `lbs`.
   - **Expected**: Form label changes to "lbs"; existing entries retain their original unit label.
2. Log a new entry.
   - **Expected**: New entry is recorded as lbs.
3. Reload the page.
   - **Expected**: Unit preference is still `lbs`.

---

### Checkpoint 5 — Responsive Layout

1. Open Chrome DevTools → Device Toolbar.
2. Set width to `320 px`.
   - **Expected**: No horizontal scrollbar; all controls visible and usable.
3. Set width to `375 px` (iPhone SE).
   - **Expected**: Same as above.
4. Set width to `1280 px` (desktop).
   - **Expected**: Layout uses wider space; no horizontal scroll.

---

### Checkpoint 6 — Docker Deployment

1. Run `docker build -t weight-tracker . && docker run --rm -p 8080:80 weight-tracker`.
2. Open `http://localhost:8080`.
   - **Expected**: App loads; all functionality works identically to the dev build.
3. Confirm no network requests are made after initial page load (DevTools → Network,
   filter by XHR/Fetch).
   - **Expected**: Zero outbound requests during normal use.
