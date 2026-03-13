# Implementation Plan: Minimal Weight Tracker

**Branch**: `001-weight-tracker-app` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-weight-tracker-app/spec.md`

## Summary

A self-contained browser app that lets a user log weight entries (value + timestamp)
stored in `localStorage` — no backend, no authentication. The app displays a
reverse-chronological history list, supports a global kg/lbs unit preference,
allows entry deletion, and is responsive on mobile and desktop. Delivered as a
static-file Docker container (nginx:alpine). Built with plain HTML, TypeScript
(via Vite), and vanilla CSS.

## Technical Context

**Language/Version**: TypeScript 5.x (browser target: ES2020); HTML5; CSS3
**Primary Dependencies**: Vite 5.x (build + dev server); Vitest 2.x + jsdom (testing)
**Storage**: Browser `localStorage` (no backend)
**Testing**: Vitest with jsdom environment
**Target Platform**: Modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+, Edge 92+);
served from nginx:alpine Docker container
**Project Type**: Static web application (single-page, no server-side runtime)
**Performance Goals**: Page load < 1 s on average consumer hardware; DOM updates
imperceptible (< 16 ms) after form submit or delete action
**Constraints**: Fully offline-capable after first load; no outbound network requests
during normal use; single Docker container; no external accounts or services
**Scale/Scope**: Single user per browser profile; personal use; designed for hundreds
of entries without degradation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                          | Status | Notes                                                  |
|------------------------------------|--------|--------------------------------------------------------|
| I. Specification-First             | ✅ PASS | `spec.md` complete and fully clarified before planning |
| II. Privacy & Data Ownership       | ✅ PASS | localStorage only; no backend; no third-party analytics; input validation specified; data-export deferred to future version (noted in spec assumptions) |
| III. Test-First (NON-NEGOTIABLE)   | ✅ GATE | Tests must be written and FAIL before implementation — enforced per user story in tasks.md |
| IV. Incremental Delivery           | ✅ PASS | Three independent user story slices; P1 (log entry) is a standalone MVP |
| V. Simplicity (YAGNI)              | ✅ PASS | No framework; Vite for zero-config TS build; nginx:alpine for Docker; no abstractions beyond current need |

**Post-Phase 1 re-check**: All five principles still pass after design. No violations
requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-weight-tracker-app/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── storage-contract.md   # localStorage schema contract
│   └── ui-contract.md        # Form, list, and layout contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── index.html           # App shell — entry point
├── css/
│   └── main.css         # Responsive styles (mobile-first, no framework)
└── ts/
    ├── main.ts          # App initialisation — wires modules, renders on load
    ├── model.ts         # WeightEntry / UserPreferences types + validation logic
    ├── storage.ts       # localStorage read/write operations (all I/O here)
    ├── preferences.ts   # Unit preference get/set, event wiring
    └── ui.ts            # DOM rendering: list, form, empty state, error messages

tests/
├── model.test.ts        # Validation rules (FR-003)
├── storage.test.ts      # localStorage CRUD and error handling
└── ui.test.ts           # DOM rendering and event handling

dist/                    # Build output — gitignored; served by Docker

Dockerfile               # Multi-stage: Vite build → nginx:alpine serve
nginx.conf               # Minimal nginx config for SPA static serving
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
```

**Structure Decision**: Single-project static web app. No backend directory needed.
Source lives in `src/`, tests in `tests/`, build output in `dist/`. The
TypeScript modules are grouped by responsibility (model, storage, preferences, ui)
to keep each independently testable.

## Complexity Tracking

> No Constitution Check violations — table not required.
