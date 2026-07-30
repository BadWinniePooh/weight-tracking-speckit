# Research: Tailwind CSS + DaisyUI UI Redesign

**Feature**: 009-tailwind-daisyui-redesign
**Date**: 2026-03-16
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Finding 1: Tailwind CSS v3 + Vite 5 Integration

**Decision**: Use PostCSS plugin approach (not `@tailwindcss/vite`)

**Rationale**: The `@tailwindcss/vite` plugin was introduced for Tailwind CSS v4 only. For Tailwind
CSS v3, the correct and documented approach is the PostCSS plugin integration. Vite 5 auto-detects
`postcss.config.js` at the project root — no changes to `vite.config.ts` are required.

**Required files**:
- `frontend/postcss.config.js`: `{ plugins: { tailwindcss: {}, autoprefixer: {} } }`
- `frontend/tailwind.config.js`: content globs + DaisyUI plugin + themes
- `frontend/src/css/main.css`: replace with `@tailwind base; @tailwind components; @tailwind utilities;`

**Alternatives considered**: `@tailwindcss/vite` (Tailwind v4 only — rejected); inline `css.postcss`
in `vite.config.ts` (works but less conventional than a dedicated `postcss.config.js` — rejected).

---

## Finding 2: DaisyUI v4 Tailwind Compatibility

**Decision**: DaisyUI v4 with Tailwind CSS v3 — confirmed compatible match

**Rationale**: DaisyUI v4 is designed for and tested against Tailwind CSS v3.x. DaisyUI v5 supports
Tailwind CSS v4. Since the spec mandates "Tailwind CSS v3 and DaisyUI v4" (FR-025), this is the
correct version pairing.

**npm install command**:
```
npm install -D tailwindcss@3 postcss autoprefixer daisyui@4
```

All four are `devDependencies` (build-time only; DaisyUI classes are compiled into the CSS bundle).

**Alternatives considered**: Upgrading to Tailwind CSS v4 + DaisyUI v5 — rejected because the spec
explicitly mandates v3 + v4, and a major version upgrade is out of scope for a UI sprint.

---

## Finding 3: OS Dark/Light Mode with DaisyUI v4

**Decision**: Use DaisyUI's built-in `prefers-color-scheme` auto-detection via theme configuration

**Rationale**: DaisyUI v4 automatically applies `@media (prefers-color-scheme: dark)` to switch
between `light` and `dark` themes when both are included in the themes config. No manual toggle or
localStorage is needed.

**Implementation**:

In `tailwind.config.js`:
```js
daisyui: {
  themes: ["light --default", "dark --prefersdark"],
}
```

The `--default` flag marks light as the base theme; `--prefersdark` designates the dark theme as
the target for `prefers-color-scheme: dark`. With this configuration, DaisyUI generates CSS that includes:
```css
@media (prefers-color-scheme: dark) {
  :root { /* dark theme variables */ }
}
```

The `<html>` element does NOT need a `data-theme` attribute for this auto-detection to work. However,
since the spec requires that "switching OS preference while the app is open updates the scheme without
a page reload" (US3 scenario 3), a minimal `theme.ts` module is needed to:
1. Listen for `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)`
2. Set `document.documentElement.setAttribute('data-theme', theme)` dynamically

This `theme.ts` module is imported in each HTML page's TypeScript entry point.

**No localStorage persistence** (spec requirement FR-026 confirmed): theme selection is never saved
to localStorage — it is always derived from the live OS preference.

**Alternatives considered**: CSS-only auto-detection (no `theme.ts`) — rejected because it doesn't
satisfy US3 scenario 3 (live updates without reload); `theme-change` library — rejected (adds a
dependency and is designed for manual toggle, not automatic OS preference).

---

## Finding 4: DaisyUI v4 Theme Selection for Health/Fitness

**Decision**: Use `light` theme as light mode base and `dark` theme as dark mode base, with custom
CSS variable overrides to establish a health/fitness palette

**Rationale**: DaisyUI v4 includes 32 built-in themes. Neither `light` nor `dark` are sports- or
health-specific, but they are the most neutral and customizable starting points. The spec assumption
states: "The DaisyUI `light` and `dark` built-in themes will be used as the starting point and
customized with the chosen health/fitness color palette." Custom colors are set via CSS variable
overrides in `main.css` under `[data-theme="light"]` and `[data-theme="dark"]` selectors.

**Health/fitness palette direction** (to be documented in design-system.md):
- Primary: vibrant emerald/teal (energy without clinical feel) — `#10b981` family
- Accent: amber/orange (warmth, motivation) — `#f59e0b` family
- Error/warning: retain DaisyUI defaults (red/yellow)
- Both themes use legible contrast ratios per WCAG AA

**Alternatives considered**: `emerald` built-in theme (only available in light) — rejected because
no matching dark counterpart; fully custom theme from scratch — rejected (over-engineering per
Simplicity principle).

---

## Finding 5: CSS Class Queries in Existing Tests

**Decision**: Refactor `ui.test.ts` before any HTML changes (US7 / FR-020)

**Affected queries** (identified in `frontend/tests/ui.test.ts`):
- `.entry-weight` (lines 437, 473, 479, 485, 492)
- `.entry-date` (lines 443, 499)
- `.entry-time` (lines 449, 505)
- `.entry-actions` (line 455)
- `.empty-state` (lines 553, 559)

**Resolution**: Add stable `data-*` attributes to the corresponding elements in `index.html` and in
the `ui.ts` DOM-generation code (which dynamically renders entry rows and the empty state). Update
`ui.test.ts` to query by `data-testid` or semantic role instead of CSS class.

No other test files were found to use CSS class-based DOM queries (confirmed by grep scan).

---

## Finding 6: Hamburger Menu Implementation

**Decision**: Vanilla TypeScript using DaisyUI's `navbar` + `drawer` components, no external library

**Rationale**: DaisyUI v4 provides `navbar`, `drawer`, and `menu` component classes. The spec
assumption states: "The hamburger menu toggle will be implemented in vanilla TypeScript/JavaScript —
no external menu library is required given DaisyUI's built-in drawer/navbar components."

**Implementation approach**:
- Desktop (≥ 768px): `navbar` with inline menu items
- Mobile (< 768px): `navbar` with hamburger button that toggles `drawer-toggle` checkbox
- Role-based link visibility is handled by existing `auth-guard.ts` logic (unchanged)

---

## Summary: New Files to Create

| File | Purpose |
|------|---------|
| `frontend/tailwind.config.js` | Tailwind + DaisyUI config; content globs; themes |
| `frontend/postcss.config.js` | PostCSS: tailwindcss + autoprefixer |
| `frontend/src/ts/theme.ts` | OS preference detection; live `data-theme` switching |
| `docs/design-system.md` | Design system documentation (FR-023) |

## Summary: Files to Modify

| File | Change |
|------|--------|
| `frontend/package.json` | Add devDependencies: tailwindcss@3, postcss, autoprefixer, daisyui@4 |
| `frontend/src/css/main.css` | Replace hand-written CSS with Tailwind directives + minimal overrides |
| `frontend/src/*.html` (7 files) | Apply DaisyUI component classes; add navbar/card layouts |
| `frontend/tests/ui.test.ts` | Replace class-based selectors with id/data-* selectors |
| `frontend/src/ts/ui.ts` | Add `data-*` attributes to dynamically generated DOM elements |
| `frontend/src/index.html` | Add `data-*` attributes to static entry row elements |
