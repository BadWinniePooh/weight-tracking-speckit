# Implementation Plan: Tailwind CSS + DaisyUI UI Redesign

**Branch**: `009-tailwind-daisyui-redesign` | **Date**: 2026-03-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-tailwind-daisyui-redesign/spec.md`

## Summary

Replace all hand-written CSS across 7 HTML pages with Tailwind CSS v3 + DaisyUI v4, adding a persistent
responsive navbar to authenticated pages, a centered-card layout to public pages, and automatic OS dark/light
mode switching. No backend changes. Styling redesign plus targeted bug fixes (stats bar live refresh,
Create User modal centering, audit log datetime format, email change notice). Test suite refactored to use
stable DOM identifiers before any HTML styling work begins.

## Technical Context

**Language/Version**: TypeScript 5.x (browser target ES2020); HTML5; CSS3
**Primary Dependencies**: Tailwind CSS v3 (PostCSS plugin), DaisyUI v4 (Tailwind plugin), Vite 5.x (existing)
**Storage**: None — no localStorage, no new DB columns
**Testing**: Vitest 2.x + jsdom (existing); no new test infrastructure
**Target Platform**: Browser — static files served by nginx (existing Docker setup)
**Project Type**: Frontend-only redesign (multi-page app, 7 HTML pages)
**Performance Goals**: No regression in build time; CSS bundle must be tree-shaken by Tailwind purge
**Constraints**: No backend changes (FR-022); styling redesign plus targeted bug fixes (FR-021 amended to permit FR-028–031); no external JS libraries beyond what already exists
**Scale/Scope**: 7 HTML pages, ~15 test files (refactor only), 1 new design-system.md doc

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | spec.md exists, complete with user stories and success criteria |
| II. Privacy & Data Ownership | ✅ PASS | No data changes; no analytics added; no third-party trackers |
| III. Test-First (NON-NEGOTIABLE) | ✅ PASS | US7 (stable identifiers + test refactor) is P1 and must execute before any HTML changes |
| IV. Incremental Delivery (MVP First) | ✅ PASS | US1+US7 are P1 MVP; US2–US4 are P1; US5–US6 are P2/P3; each independently testable |
| V. Simplicity (YAGNI) | ✅ PASS | Using DaisyUI built-in `light`/`dark` themes; no custom theme library; vanilla TS for hamburger toggle |

**Post-Phase 1 re-check**: Re-evaluate after data-model.md and contracts/ are generated.

## Project Structure

### Documentation (this feature)

```text
specs/009-tailwind-daisyui-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (design token inventory)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI component contracts)
│   └── ui-components.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code

```text
frontend/
├── src/
│   ├── css/
│   │   └── main.css            # Replace hand-written CSS with Tailwind directives + minimal overrides
│   ├── ts/
│   │   └── theme.ts            # NEW: OS preference theme init (sets data-theme on <html>)
│   ├── index.html              # Restyle: add navbar, apply DaisyUI classes
│   ├── login.html              # Restyle: centered card layout
│   ├── setup.html              # Restyle: centered card layout
│   ├── reset-request.html      # Restyle: centered card layout
│   ├── reset-complete.html     # Restyle: centered card layout
│   ├── profile.html            # Restyle: add navbar, apply DaisyUI classes
│   └── admin.html              # Restyle: add navbar, stats bar, badges, zebra tables
├── tailwind.config.js          # NEW: Tailwind + DaisyUI config
├── postcss.config.js           # NEW: PostCSS with tailwindcss + autoprefixer
├── tests/
│   └── ui.test.ts              # Refactor: replace class selectors with id/data-* selectors
└── vite.config.ts              # UNCHANGED (PostCSS auto-detected; no plugin changes needed)

docs/
└── design-system.md            # NEW: design system documentation (FR-023/FR-024)
```

**Structure Decision**: Frontend-only, single project. The existing Vite multi-page setup
(7 HTML entry points in `vite.config.ts`) is preserved. PostCSS is auto-detected by Vite when
`postcss.config.js` exists at the project root — no `vite.config.ts` changes required.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New devDependencies: tailwindcss, postcss, autoprefixer, daisyui | FR-025 mandates Tailwind CSS v3 + DaisyUI v4 | Hand-written CSS doesn't satisfy the redesign requirement |
| New `theme.ts` module | FR-026: OS preference theme switching requires a JS snippet to set `data-theme` attribute + listen for changes | Inline `<script>` in every HTML page would duplicate the same 10 lines 7 times |
