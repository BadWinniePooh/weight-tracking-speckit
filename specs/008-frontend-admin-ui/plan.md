# Implementation Plan: Frontend Admin UI and User-Facing Pages

**Branch**: `008-frontend-admin-ui` | **Date**: 2026-03-16 | **Spec**: [spec.md](./spec.md)

## Summary

Frontend-only iteration (plus one scoped backend amendment) adding four new pages — password reset request, password reset completion, user profile self-service, and admin dashboard — and navigation updates to existing pages. The single backend change adds `actorUsername` and `targetUsername` to the audit log API response via a JOIN, enabling the admin dashboard to display actor names without client-side lookup. All business logic remains on the backend; the frontend is a thin client consuming existing `api-client.ts` functions.

## Technical Context

**Language/Version**: TypeScript 5.x (browser ES2020) for all frontend work; C# 12 / .NET 8 for the one backend amendment
**Primary Dependencies**: Vite 5.x (build + dev server); Vitest 2.x + jsdom (frontend tests); existing `api-client.ts`, `auth-guard.ts`, `auth-token.ts`; xUnit + Testcontainers.PostgreSql (backend amendment test)
**Storage**: No new storage — no `localStorage` usage, no new database columns
**Testing**: Frontend — Vitest 2.x + jsdom, test files in `frontend/tests/`, mirroring `frontend/src/ts/`; Backend amendment — xUnit integration test in `WeightTracker.Tests/Integration/Endpoints/AuditLogEndpointsTests.cs`
**Target Platform**: Modern browser (ES2020+), served via nginx:alpine container
**Project Type**: Web application — multi-page frontend with REST backend
**Performance Goals**: Standard interactive web app responsiveness; audit log pagination keeps page loads lean (20 entries per request)
**Constraints**: No new npm packages; no `localStorage`; no business logic in frontend TS files; all page entry files run auth guard as first action
**Scale/Scope**: 4 new HTML pages, 4 new TS entry files, 3–4 TS support files modified, 1 backend C# file amended

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | `spec.md` complete with clarifications resolved before planning |
| II. Privacy & Data Ownership | ✅ PASS | No new data storage; no `localStorage`; no third-party analytics. Admin dashboard is protected behind role check. |
| III. Test-First (NON-NEGOTIABLE) | ✅ PASS | Every new TS file must have a failing test written first in `frontend/tests/`; backend amendment adds integration test first |
| IV. Incremental Delivery | ✅ PASS | 5 user stories ordered P1–P5; each page is independently testable and deliverable |
| V. Simplicity (YAGNI) | ✅ PASS | No new npm packages; confirmation dialogs use `window.confirm()`; stats derived client-side — no new endpoint |

**Post-Design Re-Check**: Passes. The backend amendment (audit log JOIN) is the minimum change to deliver FR-018. No additional abstractions introduced.

## Project Structure

### Documentation (this feature)

```text
specs/008-frontend-admin-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── api-amendment.md   # Audit log response shape change
│   └── frontend.md        # DOM contracts for new pages
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
frontend/
├── src/
│   ├── index.html          # Modified — add Profile + Admin nav links
│   ├── login.html          # Modified — add "Forgot password?" link
│   ├── reset-request.html  # New — password reset request page
│   ├── reset-complete.html # New — password reset completion page
│   ├── profile.html        # New — user profile self-service page
│   ├── admin.html          # New — admin dashboard page
│   └── ts/
│       ├── auth-guard.ts        # Modified — extend AuthState + enforceRedirect
│       ├── auth-token.ts        # Modified — add getUserRole() JWT decode helper
│       ├── api-client.ts        # Modified — update AuditLogEntryDto shape
│       ├── reset-request.ts     # New — entry file for reset-request.html
│       ├── reset-complete.ts    # New — entry file for reset-complete.html
│       ├── profile.ts           # New — entry file for profile.html
│       └── admin.ts             # New — entry file for admin.html
├── tests/
│   ├── auth-guard.test.ts       # Modified — add role-aware cases
│   ├── auth-token.test.ts       # Modified — add getUserRole() tests
│   ├── api-client.test.ts       # Modified — add AuditLogEntryDto type tests
│   ├── reset-request.test.ts    # New
│   ├── reset-complete.test.ts   # New
│   ├── profile.test.ts          # New
│   └── admin.test.ts            # New
└── vite.config.ts               # Modified — add 4 new entry points

backend/
└── WeightTracker.Api/
    └── Endpoints/
        └── AdminEndpoints.cs    # Modified — audit log response adds actorUsername/targetUsername
    (via JOIN in AuditLogRepository.QueryAsync or inline projection)
```

**Structure Decision**: Option 2 (Web application). Existing layout extended; no new directories created. Backend amendment is a single endpoint response projection change.

## Complexity Tracking

> No constitution violations. Table left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
