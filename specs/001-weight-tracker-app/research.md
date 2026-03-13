# Research: Minimal Weight Tracker

**Feature**: 001-weight-tracker-app
**Date**: 2026-03-13
**Phase**: 0 — Pre-design toolchain and pattern decisions

---

## 1. Build Toolchain

**Decision**: Vite

**Rationale**: Vite provides native TypeScript support with near-zero configuration,
a fast development server with HMR, and produces a single optimised JS bundle for
production via Rollup/esbuild. It is the simplest path from `.ts` source to a
production-ready static `dist/` directory without custom configuration files.

**Alternatives considered**:
- `esbuild` CLI: Faster raw build speed but no dev server or HMR out-of-the-box;
  requires more manual wiring for a complete workflow.
- `tsc` only: Outputs modules but does not bundle; requires a separate bundler and
  dev server.
- Parcel: Zero-config but slower HMR and less predictable output structure.

---

## 2. Testing Framework

**Decision**: Vitest + jsdom

**Rationale**: Vitest is the natural companion to Vite — it reuses the same config
and TypeScript pipeline, eliminating any separate Babel/ts-jest configuration. It
runs tests in a jsdom environment that accurately simulates `localStorage` and DOM
APIs used by this app. Cold start is ~6x faster than Jest.

**Alternatives considered**:
- Jest + ts-jest: More configuration overhead; requires separate TypeScript transform
  setup; no native ESM support without extra flags.
- Playwright: End-to-end browser testing is valuable but overkill for unit-level
  localStorage and validation logic.

---

## 3. Docker Base Image for Static Files

**Decision**: `nginx:alpine`

**Rationale**: nginx:alpine is ~8 MB, widely understood, and has battle-tested static
file serving with `sendfile` optimisation. A minimal custom `nginx.conf` is sufficient
to serve the `dist/` directory with correct MIME types and cache headers.

**Alternatives considered**:
- Caddy: Simpler HTTPS config but ~45 MB and adds unnecessary capability for a
  purely static, self-hosted use case.
- lighttpd: Smallest image but less common; higher risk of unfamiliar configuration
  edge cases.

---

## 4. Unique Entry IDs

**Decision**: `crypto.randomUUID()` (native browser API)

**Rationale**: Available in all target browsers (Chrome 92+, Firefox 95+, Safari 15.4+,
Edge 92+ — all well within "modern browser" support as of 2026). Produces
cryptographically random UUIDs with no external dependency.

**Alternatives considered**:
- `uuid` npm package: Unnecessary dependency when the native API exists.
- Timestamp-based IDs: Collision-prone if two entries are submitted within the same
  millisecond (unlikely but not impossible in testing).

---

## 5. localStorage Usage Patterns

**Decision**: JSON serialization with explicit `try/catch` on all writes

**Key patterns**:
- Serialize with `JSON.stringify()` before storing; deserialize with `JSON.parse()`
  on retrieval; always guard against `null` (key not present) before parsing.
- Wrap all `localStorage.setItem()` calls in `try/catch` to handle
  `QuotaExceededError` gracefully (quota is typically 5–10 MB per origin).
- On `QuotaExceededError`, surface a clear user-facing message ("Storage is full —
  please delete some entries before adding new ones.") rather than silently failing.
- Store the entries array under a single key; read the full array, modify in memory,
  then write back. For this app's scale (personal use, hundreds of entries) this is
  safe and simple.

---

## Summary of Technical Stack

| Concern          | Choice              | Reason                              |
|------------------|---------------------|-------------------------------------|
| Language         | TypeScript          | Specified by user                   |
| UI               | Plain HTML + CSS    | Specified by user; no framework     |
| Build            | Vite                | Near-zero config, TS-native         |
| Tests            | Vitest + jsdom      | Vite-native, fast, no extra config  |
| Persistence      | Browser localStorage| Specified; no backend               |
| Unique IDs       | crypto.randomUUID() | Native, no dependency               |
| Container        | nginx:alpine        | Small, reliable static file serving |
