# Implementation Plan: Full-Stack Architecture Documentation

**Branch**: `016-fullstack-arch-docs` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-fullstack-arch-docs/spec.md`

---

## Summary

Produce `ARCHITECTURE.md` at the project root — a comprehensive, self-contained reference covering all architectural patterns (Ports & Adapters, Repository, JWT + Refresh Token, Testcontainers), implementation guidelines, decision rationale, and a full worked example tracing a fictional "Note" entity through all 7 layers. Additionally, add a compact "Architecture Quick Reference" section to `CLAUDE.md` so that the most critical layer-placement rules and coding conventions are auto-loaded into every Claude Code session without requiring the AI to explicitly read `ARCHITECTURE.md`.

---

## Technical Context

**Language/Version**: Markdown (CommonMark + GitHub Flavored Markdown); no code compilation
**Primary Dependencies**: None — documentation only
**Storage**: N/A — no new data storage; output files only
**Testing**: N/A — no automated tests; validation is manual (checklist in spec)
**Target Platform**: GitHub-rendered Markdown (human readers); Claude Code context window (AI readers)
**Project Type**: Documentation
**Performance Goals**: N/A
**Constraints**: `CLAUDE.md` additions must remain compact (auto-loaded into every AI session — must not bloat context); `ARCHITECTURE.md` must use actual file/class names from the codebase
**Scale/Scope**: 2 output files: `ARCHITECTURE.md` (~600-900 lines) + `CLAUDE.md` additions (~30-40 lines)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | `spec.md` written and validated before this plan |
| II. Privacy & Data Ownership | ✅ PASS (N/A) | Documentation only; no health data involved |
| III. Test-First (TDD) | ✅ PASS (N/A) | No executable code produced; validation is manual review against spec checklist |
| IV. Incremental Delivery (MVP First) | ✅ PASS | P1 (human developer onboarding) deliverable independently of P2/P3 |
| V. Simplicity (YAGNI) | ✅ PASS | Option C (ARCHITECTURE.md + CLAUDE.md) chosen over Option B (split files) — no unnecessary file proliferation |

**Post-design re-check**: All gates still pass. No violations to justify.

---

## Project Structure

### Documentation (this feature)

```text
specs/016-fullstack-arch-docs/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Output structure decision, worked example choice
├── data-model.md        # Document structure model (sections per file)
├── checklists/
│   └── requirements.md  # Spec quality checklist (already complete)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Files (deliverables)

```text
ARCHITECTURE.md          # New file — primary output (project root)
CLAUDE.md                # Existing file — add Architecture Quick Reference section
```

---

## Complexity Tracking

No constitution violations. No complexity deviations required.

---

## Phase 0: Research (Complete)

See [research.md](./research.md). All decisions resolved:

1. **Output structure**: Option C — `ARCHITECTURE.md` + targeted `CLAUDE.md` additions
2. **CLAUDE.md content**: Compact quick-reference (layer rules + 4 critical patterns) + link to `ARCHITECTURE.md`
3. **Worked example entity**: "Note" (text string attached to a WeightEntry; simple one-to-many)
4. **ARCHITECTURE.md placement**: Project root, same level as `README.md` and `CLAUDE.md`

---

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md). Document structure defined:

### ARCHITECTURE.md Section Map

| # | Section | Key Content |
|---|---------|-------------|
| 1 | Overview | Project purpose + Ports & Adapters philosophy (2-3 paragraphs) |
| 2 | Repository Structure | Annotated directory tree: backend 4 projects + frontend src/ts/ layout |
| 3 | Backend: Ports & Adapters | Domain has zero deps; Infrastructure implements interfaces; Api orchestrates. Rationale: testability, replaceability, prevents leaking ORM concerns into domain logic |
| 4 | Backend: Repository Pattern | Interface in Domain (`IFooRepository`), implementation in Infrastructure (`FooRepository`). Why: Domain layer must not reference EF Core |
| 5 | Backend: Dependency Injection | All services/repos registered Scoped in `Program.cs`. Primary constructor injection throughout. Pattern: `public class FooService(IFooRepository repo, IBarService bar)` |
| 6 | Backend: Auth Flow | Login → JWT (15 min) + Refresh token (7 days, hashed SHA256, stored in DB) + HTTP-only cookie. Refresh rotation on use. `CurrentUserMiddleware` sets `httpContext.Items["CurrentUserId"]`. Why: short-lived access tokens limit blast radius; rotation invalidates stolen tokens |
| 7 | Backend: Testcontainers | `ApiFixture : WebApplicationFactory<Program>` + `IAsyncLifetime`. Real PostgreSQL container. No database mocks. Why: mock divergence caused prod failures; Testcontainers eliminate the gap |
| 8 | Backend: Adding New Features | Table: Domain entity → `Domain/Entities/`, Interface → `Domain/Interfaces/`, Implementation → `Infrastructure/...`, Endpoint group → `Api/Endpoints/`, Test → `Tests/Integration/...` |
| 9 | Frontend: Module Overview | api-client.ts (typed HTTP + silent refresh), auth-guard.ts (auth state + redirects), auth-token.ts (in-memory token storage), config.ts (runtime API URL), theme.ts (system dark/light) |
| 10 | Frontend: api-client.ts | `request<T>(path, init)` — attaches Bearer token, handles 401 → refresh → retry (with deduplication lock). Why: all pages get silent refresh for free; auth logic is not repeated |
| 11 | Frontend: auth-guard.ts | `checkAuthStatus()` → checks `/api/setup/status` then attempts silent refresh. `enforceRedirect(pageType, state)` → redirects based on auth state. Call at page load |
| 12 | Frontend: Tailwind + DaisyUI | `@import "tailwindcss"` + `@plugin "daisyui"` in main.css. Theme via `data-theme="light/dark"` on `<html>`. Custom OKLch palette in CSS vars. DaisyUI component classes (btn, card, form-control, etc.) |
| 13 | Frontend: Vite Build | Multi-page: each `.html` is a separate rollup input. `root: "src"`, `publicDir: "../public"`, `outDir: "../dist"`. `vite-plugin-pwa` generates service worker + manifest |
| 14 | Docker Compose | 3 services: db → backend → frontend (health-check-ordered). `envsubst` injects `API_URL` into `config.json` at nginx startup. Traefik labels handle SSL/routing |
| 15 | Worked Example: Note | Full trace: Domain entity → Interface → Infrastructure implementation → EF Core DbSet + OnModelCreating → Api endpoint group → `Program.cs` Scoped registration → Integration test. Includes actual file paths and class/method signatures |
| 16 | Decision Rationale Index | Minimal API (vs MVC controllers): less ceremony, endpoint groups are cohesive, no attribute routing indirection. Testcontainers (vs mocks): eliminates mock/prod divergence. Ports & Adapters: protects domain from infrastructure churn. api-client abstraction: single auth-handling point, eliminates scattered fetch calls |
| 17 | Version Notice | "This document reflects the architecture as of feature 016. Check `specs/` for patterns introduced in later features." |

### CLAUDE.md Addition

Insert before `<!-- MANUAL ADDITIONS START -->`:

```markdown
## Architecture Quick Reference (016-fullstack-arch-docs)

See `ARCHITECTURE.md` for full context, rationale, and worked example.

### Backend Layer Placement

| What | Project | Directory |
|------|---------|-----------|
| New entity | `WeightTracker.Domain` | `Entities/` |
| Repository interface | `WeightTracker.Domain` | `Interfaces/` |
| Repository implementation | `WeightTracker.Infrastructure` | `Repositories/` |
| Service interface | `WeightTracker.Domain` | `Interfaces/` |
| Service implementation | `WeightTracker.Infrastructure` | `Services/` |
| API endpoint group | `WeightTracker.Api` | `Endpoints/` (as `MapXxxEndpoints()` extension) |
| Integration test | `WeightTracker.Tests` | `Integration/` (mirrors source path) |

Register all new services and repositories as **Scoped** in `WeightTracker.Api/Program.cs`.

### Critical Patterns

- **Current user in endpoints**: `var userId = (Guid)httpContext.Items["CurrentUserId"]!;` — never read JWT claims directly in handlers.
- **Frontend API calls**: Always use `request<T>()` from `api-client.ts` — never raw `fetch()` — to inherit silent token refresh.
- **New authenticated pages**: Call `checkAuthStatus()` then `enforceRedirect(pageType, state)` from `auth-guard.ts` at page load before rendering.
- **Integration tests**: Use `ApiFixture` with `CreateAuthenticatedClient()`. Real PostgreSQL via Testcontainers — no mocks.
```

---

## Implementation Sequence

This feature produces documentation only. The natural implementation order follows the section map above — backend concepts first, then frontend, then Docker, then the worked example (which references all prior sections), then the rationale index.

### Phase 1: `ARCHITECTURE.md` — Backend Sections (P1 delivery)

Produces sections 1-8. Covers all backend architecture. Sufficient for P1 user story (new developer onboards).

### Phase 2: `ARCHITECTURE.md` — Frontend + Infrastructure Sections

Produces sections 9-14. Completes the full reference document.

### Phase 3: `ARCHITECTURE.md` — Worked Example + Rationale Index

Produces sections 15-17. The worked example is the highest-value single section. Completes P2 and P3 user stories.

### Phase 4: `CLAUDE.md` Addition

Adds the compact quick-reference section to `CLAUDE.md`. Completes AI-context delivery.

---

## Quickstart: Using This Documentation

**For human developers**: Read `ARCHITECTURE.md` top-to-bottom on first join. Jump to "Adding New Features" section when starting a new task. Use the "Worked Example" section as a template.

**For AI coding sessions**: `CLAUDE.md` is auto-loaded and contains the critical rules. Read `ARCHITECTURE.md` when you need full rationale or the complete worked example as a template.

**For maintainers**: When a new feature introduces a new pattern, update `ARCHITECTURE.md` and the `CLAUDE.md` quick reference. Note the feature number next to changed sections (matching the existing convention in `CLAUDE.md`).
