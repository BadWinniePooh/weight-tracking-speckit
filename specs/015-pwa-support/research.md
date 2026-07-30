# Research: PWA Support (015-pwa-support)

## Decision 1: PWA Build Plugin

**Decision**: Use `vite-plugin-pwa` with the `generateSW` strategy.

**Rationale**: It integrates directly with Vite's build pipeline, automatically injects `<link rel="manifest">` and the service worker registration script into **all** HTML entry points defined in `vite.config.ts`'s `rollupOptions.input` — no manual changes to any of the 8 HTML files required. It wraps Workbox under the hood, which handles cache versioning and invalidation automatically.

**Alternatives considered**:
- Hand-rolling a service worker + `manifest.json` — rejected as unnecessary complexity when a well-maintained plugin covers the use case completely (violates YAGNI).
- `injectManifest` strategy — allows custom SW code but is only needed for push notifications or background sync, both out of scope.

---

## Decision 2: Minimum Service Worker Strategy

**Decision**: `generateSW` with `workbox: { globPatterns: [] }` (no asset precaching).

**Rationale**: Chrome's PWA installability only requires that a service worker exists and responds to `fetch` events. It does NOT require that anything be cached. Setting `globPatterns: []` produces a minimal pass-through service worker that satisfies the browser without implementing offline support. This matches the spec's explicit out-of-scope clause for full offline mode.

**Alternatives considered**:
- Full precaching of all assets — rejected, offline support is out of scope and adds cache invalidation complexity.
- `registerType: 'prompt'` — rejected, spec says install prompt should appear via browser heuristics with no custom UI.

---

## Decision 3: Service Worker Update Behavior

**Decision**: `registerType: 'autoUpdate'`.

**Rationale**: On each page load, the browser re-fetches the service worker file (browsers never cache SW files). Workbox embeds a content hash into the generated SW on each build. When the hash changes (i.e., a new deploy), Workbox automatically installs the new SW and activates it on next navigation. No user action is needed. This satisfies FR-005 and SC-003 without any additional configuration.

**Alternatives considered**:
- `registerType: 'prompt'` — shows a "reload for update" UI, which requires custom in-app UI work; out of scope.

---

## Decision 4: App Icons

**Decision**: Commit hand-generated or tool-generated PNG icons at 192×192 and 512×512 directly to `frontend/public/icons/`.

**Rationale**: PNG is the only reliably supported format for PWA manifest icons across Android, iOS, and desktop. SVG is not consistently supported. Two sizes (192 and 512) are the minimum for Chrome Android installability. The spec explicitly states a placeholder icon is acceptable.

**Icon generation options** (implementer's choice):
- Generate from an SVG source using the `sharp` npm package at build time.
- Create manually or via an online tool (e.g., a filled circle or letter icon) and commit as static assets.

**Recommendation**: Commit static PNGs. No build-time generation dependency needed for a placeholder icon. If a branded icon is added later, the files can simply be replaced.

**Alternatives considered**:
- Maskable icons (Android Adaptive Icons) — nice-to-have; can be added later by adding a `"purpose": "maskable"` icon entry. Not required for basic installability.

---

## Decision 5: Vitest Build Output Tests

**Decision**: Write Vitest tests in `tests/pwa/pwa-build.test.ts` that read the `frontend/dist/` directory after a build and assert manifest correctness and file existence.

**Rationale**: These tests are file-system assertions — no browser needed. They validate the build produces correct output before deployment. They serve as the TDD acceptance tests for FR-001 through FR-005 and FR-008.

**Test scope**:
- `manifest.webmanifest` exists in `dist/` and is valid JSON
- Manifest contains required fields: `name`, `short_name`, `start_url`, `display: "standalone"`, `icons`
- All icon paths referenced in manifest exist as files in `dist/`
- `sw.js` exists in `dist/`
- All 8 HTML output files in `dist/` contain a SW registration script reference

**What cannot be tested without a browser**:
- Actual service worker activation
- Install prompt appearance
- Standalone launch mode

---

## Decision 6: No `data-model.md` Required

**Decision**: Skip `data-model.md` for this feature.

**Rationale**: PWA support introduces no new data entities, no database schema changes, and no new application state. The manifest and icons are static build artifacts, not data. There is nothing to model.
