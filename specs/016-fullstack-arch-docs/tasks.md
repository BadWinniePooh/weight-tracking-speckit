---
description: "Task list for Full-Stack Architecture Documentation"
---

# Tasks: Full-Stack Architecture Documentation

**Input**: Design documents from `/specs/016-fullstack-arch-docs/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: Not applicable — documentation feature; validation is manual review against spec checklist.

**Organization**: Tasks grouped by user story. US1 (backend + frontend pattern sections) → US2 (CLAUDE.md AI context) → US3 (worked example + rationale).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (independent sections, no content dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Create the output file scaffold.

- [x] T001 Create `ARCHITECTURE.md` at project root with document title, preamble line ("Architecture as of feature 016"), and placeholder headings for all 17 sections from `specs/016-fullstack-arch-docs/data-model.md` section map

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Write the overview and repository structure sections that every later section cross-references.

**⚠️ CRITICAL**: No user story content can be written until this phase is complete — later sections reference these structural definitions.

- [x] T002 Write **Overview** section in `ARCHITECTURE.md`: 2-3 paragraphs covering project purpose (personal weight tracking, self-hosted), the Ports & Adapters philosophy (Domain has zero external dependencies; Infrastructure implements Domain interfaces; Api layer orchestrates), and the dual-audience intent of this document
- [x] T003 Write **Repository Structure** section in `ARCHITECTURE.md`: annotated directory tree for the backend (4 projects: `WeightTracker.Domain/`, `WeightTracker.Infrastructure/`, `WeightTracker.Api/`, `WeightTracker.Tests/`) and frontend (`frontend/src/ts/` key modules: `api-client.ts`, `auth-guard.ts`, `auth-token.ts`, `config.ts`, `theme.ts`; `frontend/src/css/main.css`; `frontend/src/*.html` page entries)

**Checkpoint**: Foundation ready — all pattern sections can now be written in parallel.

---

## Phase 3: User Story 1 — New Developer Onboards Without Guidance (Priority: P1) 🎯 MVP

**Goal**: Complete `ARCHITECTURE.md` with all backend and frontend pattern sections. A new developer reading only this document can correctly place any new file and explain every architectural pattern.

**Independent Test**: Give the document (no codebase access) to a developer; they correctly answer "where does each new file type go?" for all 6 file types and can explain the rationale for Minimal API, Testcontainers, and the auth-guard abstraction.

### Backend Architecture Sections

- [x] T004 [P] [US1] Write **Backend: Ports & Adapters** section in `ARCHITECTURE.md`: explain the three-layer boundary (Domain = pure C# entities + interfaces, zero external deps; Infrastructure = EF Core repositories + services implementing Domain interfaces; Api = ASP.NET Core Minimal API orchestrating DI-injected services); include rationale: testability (Infrastructure can be swapped), prevents ORM concerns leaking into domain logic, enables Testcontainers pattern
- [x] T005 [P] [US1] Write **Backend: Repository Pattern** section in `ARCHITECTURE.md`: explain that repository interfaces live in `WeightTracker.Domain/Interfaces/` (e.g., `IWeightEntryRepository`), implementations live in `WeightTracker.Infrastructure/Repositories/` (e.g., `WeightEntryRepository`); show the primary-constructor injection pattern (`public class WeightEntryRepository(AppDbContext db)`); rationale: Domain layer must never reference EF Core — only interfaces
- [x] T006 [P] [US1] Write **Backend: Dependency Injection** section in `ARCHITECTURE.md`: explain all new services and repositories are registered as Scoped in `WeightTracker.Api/Program.cs`; show the registration pattern (`builder.Services.AddScoped<IFooRepository, FooRepository>()`); explain primary constructor injection used throughout (`public class FooService(IFooRepository repo, IBarService bar)`) and why Scoped (per-request lifetime, safe for DbContext access)
- [x] T007 [P] [US1] Write **Backend: Auth Flow (JWT + Refresh Tokens)** section in `ARCHITECTURE.md`: trace end-to-end flow — (1) POST /api/auth/login returns access token (JWT, 15-min expiry, HMAC SHA256, issuer "weight-tracker") + refresh token (HTTP-only cookie); (2) refresh token stored hashed (SHA256 → lowercase hex) in `RefreshTokens` table, 7-day expiry; (3) POST /api/auth/refresh rotates the pair (old token revoked, new pair issued); (4) `CurrentUserMiddleware` extracts `ClaimTypes.NameIdentifier` from JWT and sets `httpContext.Items["CurrentUserId"]`; (5) endpoint handlers access current user via `var userId = (Guid)httpContext.Items["CurrentUserId"]!;` — never read JWT claims directly; rationale: short-lived access tokens limit blast radius; rotation invalidates stolen refresh tokens
- [x] T008 [P] [US1] Write **Backend: EF Core + Testcontainers** section in `ARCHITECTURE.md`: explain `ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime` spins up a real PostgreSQL 16-alpine container via Testcontainers; show test class pattern (implements `IClassFixture<ApiFixture>`); show authenticated client creation (`_client = fixture.CreateAuthenticatedClient()`); explain test file naming convention (mirrors source: `Infrastructure/Repositories/FooRepository.cs` → `Tests/Integration/Repositories/FooRepositoryTests.cs`); all test files in `WeightTracker.Tests/`; rationale: prior mock/prod divergence caused migration failures — Testcontainers eliminates the gap
- [x] T009 [US1] Write **Backend: Adding a New Feature** section in `ARCHITECTURE.md`: produce a per-layer directory table (columns: File Type | Project | Directory | Example); rows: Domain entity, repository interface, service interface, repository implementation, service implementation, API endpoint group, integration test; then list the 3 registration steps in `Program.cs` (DbSet in AppDbContext, Scoped registration, `app.MapFooEndpoints()` call)

### Frontend Architecture Sections

- [x] T010 [P] [US1] Write **Frontend: Module Overview** section in `ARCHITECTURE.md`: one paragraph per module explaining its single responsibility and rationale — `api-client.ts` (typed HTTP calls + silent refresh — see dedicated section T011); `auth-guard.ts` (auth state check + page redirect logic — see dedicated section T012); `auth-token.ts` (stores the Bearer access token **in memory only** — never in localStorage or sessionStorage; rationale: in-memory storage prevents XSS-based token theft since injected scripts cannot access module-scoped variables; consequence: token is lost on page reload, which is intentional — `auth-guard.ts` silently re-acquires it via the refresh cookie); `config.ts` (loads `/config.json` at startup via `fetch` and exposes `getApiUrl()` — the `/config.json` file does not exist in the source repository; it is generated at nginx container startup by running `envsubst` on `frontend/public/config.json.template`, substituting the `API_URL` environment variable; this allows the same Docker image to point at different backend URLs without rebuild); `theme.ts` (detects `prefers-color-scheme`, sets `data-theme` attribute on `<html>` immediately on module import to prevent flash-of-wrong-theme before DOMContentLoaded)
- [x] T011 [P] [US1] Write **Frontend: api-client.ts** section in `ARCHITECTURE.md`: explain the `request<T>(path, init?)` helper — attaches Bearer token from `auth-token.ts`, on 401 calls `attemptRefresh()` (with deduplication lock `_refreshPromise` to prevent concurrent refresh storms), retries once with new token; show the pattern for adding a new API call (`export async function fetchFoo(): Promise<FooResponse> { return request<FooResponse>("/api/foo"); }`); rationale: all pages get silent refresh for free without repeating auth logic
- [x] T012 [P] [US1] Write **Frontend: auth-guard.ts** section in `ARCHITECTURE.md`: explain `checkAuthStatus()` — checks `/api/setup/status` for first-run, then POSTs to `/api/auth/refresh` with `credentials: "include"` for silent refresh, returns `AuthState` object; explain `enforceRedirect(pageType, state)` — pageType values ("app", "login", "setup", "profile", "admin", "public") and what redirect each combination triggers; show page-load call pattern (call `checkAuthStatus()`, call `enforceRedirect()`, then render); rationale: auth state check is complex (setup detection + silent refresh) — centralizing prevents each page from diverging
- [x] T013 [P] [US1] Write **Frontend: Tailwind CSS v4 + DaisyUI v5** section in `ARCHITECTURE.md`: explain CSS-first config (`@import "tailwindcss"` + `@plugin "daisyui"` in `frontend/src/css/main.css`); explain theme via `data-theme="light"/"dark"` on `<html>` element set by `theme.ts`; show custom OKLch palette CSS variable pattern (`--p: oklch(0.59 0.145 163)` for primary); explain DaisyUI component class conventions (use semantic classes: `btn btn-primary`, `card`, `form-control`, `input input-bordered` — not raw Tailwind utility soup); note: Tailwind v4 uses `@tailwindcss/vite` plugin (not PostCSS), DaisyUI v5 is a `devDependency`
- [x] T014 [P] [US1] Write **Frontend: Vite Build Setup** section in `ARCHITECTURE.md`: explain multi-page configuration in `frontend/vite.config.ts` — `root: "src"`, `publicDir: "../public"`, `build.outDir: "../dist"`; show the `rollupOptions.input` map (8 HTML entry points); explain that each `.html` file becomes a separate page bundle; explain `vite-plugin-pwa` generates service worker (`generateSW` strategy) and web app manifest; note dev server runs from `frontend/` with `npm run dev`
- [x] T015 [US1] Write **Docker Compose & Runtime Config** section in `ARCHITECTURE.md`: explain 3-service ordering (db → backend → frontend, enforced by `depends_on: condition: service_healthy`); explain `envsubst` pattern — `frontend/public/config.json.template` contains `{"apiUrl": "${API_URL}"}`, nginx entrypoint runs `envsubst` to produce `/config.json` at container startup; explain Traefik labels (SSL termination, `Host()` routing rule, rate limiting middleware on auth endpoints at 5 req/min); list required environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `API_URL`, `APP_DOMAIN`, `ALLOWED_ORIGIN`)

**Checkpoint**: US1 complete. `ARCHITECTURE.md` contains all pattern sections. A new developer reading this document can onboard without additional guidance.

---

## Phase 4: User Story 2 — AI Coding Session Uses Docs as Authoritative Context (Priority: P2)

**Goal**: Add a compact "Architecture Quick Reference" section to `CLAUDE.md` so the most critical layer-placement rules and coding conventions are auto-loaded into every Claude Code session.

**Independent Test**: Start a new Claude Code session (no explicit loading of `ARCHITECTURE.md`). Ask the AI to scaffold a new repository. It correctly places the interface in `WeightTracker.Domain/Interfaces/`, implementation in `WeightTracker.Infrastructure/Repositories/`, registers it Scoped in `Program.cs`, and places the test in `WeightTracker.Tests/Integration/Repositories/` — from CLAUDE.md context alone.

- [x] T016 [US2] Add **Architecture Quick Reference** section to `CLAUDE.md`: insert the following block immediately before the `<!-- MANUAL ADDITIONS START -->` marker — (1) section heading `## Architecture Quick Reference (016-fullstack-arch-docs)`; (2) note "See `ARCHITECTURE.md` for full context, rationale, and worked example"; (3) **Backend Layer Placement** table with columns (What | Project | Directory) and 7 rows: Domain entity → `WeightTracker.Domain/Entities/`, Repository interface → `WeightTracker.Domain/Interfaces/`, Service interface → `WeightTracker.Domain/Interfaces/`, Repository implementation → `WeightTracker.Infrastructure/Repositories/`, Service implementation → `WeightTracker.Infrastructure/Services/`, API endpoint group → `WeightTracker.Api/Endpoints/` as `MapXxxEndpoints()` extension method, Integration test → `WeightTracker.Tests/Integration/` mirroring source path; (4) note "Register all new services and repositories as **Scoped** in `WeightTracker.Api/Program.cs`"; (5) **Critical Patterns** bullet list: current user (`var userId = (Guid)httpContext.Items["CurrentUserId"]!;` — never raw JWT claims), frontend API calls (use `request<T>()` from `api-client.ts` — never raw `fetch()`), new authenticated pages (call `checkAuthStatus()` then `enforceRedirect(pageType, state)` from `auth-guard.ts` at page load), integration tests (use `ApiFixture` + `CreateAuthenticatedClient()`, real PostgreSQL via Testcontainers — no mocks)

**Checkpoint**: US2 complete. CLAUDE.md now auto-loads critical architecture rules into every session.

---

## Phase 5: User Story 3 — Developer Adds a Feature Using Documentation as Blueprint (Priority: P3)

**Goal**: Complete `ARCHITECTURE.md` with the worked example (traces a fictional entity through all 7 layers) and the rationale index (explains the "why" behind each major decision). A developer can use this as a blueprint to add any new feature without reverse-engineering existing code.

**Independent Test**: Ask a developer to list the complete file set for a new "Meals" feature using only the documentation. They correctly enumerate all 7 file types with correct paths and naming. They can explain why Minimal API was chosen over MVC controllers without reading any code.

- [x] T017 [US3] Write **Worked Example: Adding a "Note" Entity** section in `ARCHITECTURE.md`: trace the fictional `Note` entity (short text string attached to a `WeightEntry`, owned by a `User`) through all 8 steps (6 new files + 2 existing-file modifications) with concrete file paths and class/method signatures — (1) Domain entity: `WeightTracker.Domain/Entities/Note.cs` with properties `Id` (Guid), `WeightEntryId` (Guid), `UserId` (Guid), `Text` (string, max 500), `CreatedAt` (DateTime); (2) Repository interface: `WeightTracker.Domain/Interfaces/INoteRepository.cs` with methods `GetByEntryIdAsync(Guid entryId, Guid userId)`, `AddAsync(Note note)`, `DeleteAsync(Guid id, Guid userId)`; (3) Infrastructure implementation: `WeightTracker.Infrastructure/Repositories/NoteRepository.cs` implementing `INoteRepository` with primary constructor `(AppDbContext db)` and user-scoped queries; (4) EF Core: add `DbSet<Note> Notes` to `AppDbContext.cs`, add `OnModelCreating` config (FK to WeightEntries with cascade delete, composite index on `(WeightEntryId, UserId)`); (5) API endpoint group: `WeightTracker.Api/Endpoints/NoteEndpoints.cs` with `MapNoteEndpoints()` extension, 3 endpoints (`GET /api/entries/{entryId}/notes`, `POST /api/entries/{entryId}/notes`, `DELETE /api/entries/{entryId}/notes/{id}`), all requiring auth, extracting `CurrentUserId` from `httpContext.Items`; (6) Program.cs: `builder.Services.AddScoped<INoteRepository, NoteRepository>()` + `app.MapNoteEndpoints()`; (7) Frontend TypeScript module: `frontend/src/ts/notes.ts` — export `fetchNotes(entryId: string): Promise<NoteResponse[]>` using `request<NoteResponse[]>` from `api-client.ts`, showing that all new frontend API calls follow this same pattern (one function per API operation, typed return, no raw fetch); (8) Integration test: `WeightTracker.Tests/Integration/Endpoints/NoteEndpointsTests.cs` using `IClassFixture<ApiFixture>`, `CreateAuthenticatedClient()`, asserting all 3 CRUD operations
- [x] T018 [P] [US3] Write **Architecture Decisions: Rationale Index** section in `ARCHITECTURE.md`: one focused paragraph per decision — (1) Minimal API over MVC controllers: less ceremony, endpoint groups co-locate related handlers, no attribute routing indirection, easier to trace request flow, no `[FromBody]`/`[FromRoute]` annotation noise; (2) Testcontainers over database mocks: prior incident where mocked tests passed but prod migration failed due to mock/real divergence — Testcontainers runs the exact PostgreSQL version used in production, eliminating the gap entirely; (3) Ports & Adapters: protects domain logic from infrastructure churn — swapping ORMs or email providers requires only new Infrastructure classes, not domain changes; also enables unit testing of domain logic without any DB dependency; (4) Frontend api-client/auth-guard abstraction: prevents each of the 8 pages from independently implementing silent refresh and auth redirects — centralizing means a bug fix or token strategy change is made in one place
- [x] T019 [P] [US3] Write **Version Notice** section in `ARCHITECTURE.md`: add a brief callout box (blockquote) stating "This document reflects the architecture as of feature 016 (PWA support). Features introduced after 016 may add new patterns. Check the `specs/` directory for spec files numbered above 016 to find patterns not covered here."

**Checkpoint**: US3 complete. `ARCHITECTURE.md` is the complete architecture reference — all patterns, guidelines, rationale, and worked example are present.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass to ensure the document is internally consistent, cross-references are accurate, and terminology matches the codebase.

- [x] T020 [P] Review all sections of `ARCHITECTURE.md` for terminology consistency: verify all class names (`AppDbContext`, `WeightTracker.Domain`, `ApiFixture`, `CurrentUserMiddleware`, `JwtTokenService`, `BcryptPasswordHasher`), file names (`api-client.ts`, `auth-guard.ts`, `auth-token.ts`), and method names (`checkAuthStatus`, `enforceRedirect`, `CreateAuthenticatedClient`, `MapXxxEndpoints`) match actual codebase names exactly (cross-reference against codebase using Grep/Read)
- [x] T021 [P] Add a **Table of Contents** near the top of `ARCHITECTURE.md` with anchor links to all 17 sections, enabling quick navigation in GitHub Markdown rendering

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — creates the scaffold T001 fills
- **Phase 3 (US1 — backend + frontend)**: Depends on Phase 2 — backend sections (T004-T009) and frontend sections (T010-T015) can all be written in parallel once Phase 2 is complete
- **Phase 4 (US2 — CLAUDE.md)**: Can start in parallel with Phase 3 — CLAUDE.md is a different file with no content dependency on ARCHITECTURE.md sections being written
- **Phase 5 (US3 — worked example + rationale)**: The worked example (T017) references patterns established in Phase 3; run after Phase 3 is complete
- **Phase 6 (Polish)**: Depends on all content phases complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2. T004-T008 fully parallel. T009 and T015 depend on their parallel siblings being complete (they reference content from them). T010-T014 fully parallel.
- **US2 (P2)**: Independent — can start after Phase 1. No dependency on US1 content.
- **US3 (P3)**: T017, T018, T019 can run in parallel after Phase 3 completes.

### Parallel Opportunities

- T004, T005, T006, T007, T008 can all run in parallel (distinct sections, no shared content)
- T010, T011, T012, T013, T014 can all run in parallel
- T016 (US2) can run in parallel with all of Phase 3
- T017, T018, T019 can run in parallel (within Phase 5)
- T020, T021 can run in parallel (within Phase 6)

---

## Parallel Execution Examples

### Phase 3: US1 Backend (run simultaneously)

```
Task T004: Write Ports & Adapters section
Task T005: Write Repository Pattern section
Task T006: Write Dependency Injection section
Task T007: Write Auth Flow section
Task T008: Write EF Core + Testcontainers section
```

### Phase 3: US1 Frontend (run simultaneously after T009 starts)

```
Task T010: Write Frontend Module Overview
Task T011: Write api-client.ts section
Task T012: Write auth-guard.ts section
Task T013: Write Tailwind + DaisyUI section
Task T014: Write Vite Build Setup section
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003)
3. Complete Phase 3: US1 — all backend and frontend pattern sections (T004-T015)
4. **STOP and VALIDATE**: Can a new developer answer all 6 "where does this go?" questions correctly?
5. `ARCHITECTURE.md` is immediately useful at this point

### Incremental Delivery

1. Phase 1-2 → Document scaffold + Overview
2. Phase 3 → Full pattern reference for developers (MVP for US1)
3. Phase 4 → AI context injection via CLAUDE.md (US2 complete)
4. Phase 5 → Worked example + rationale (US3 complete — full blueprint value)
5. Phase 6 → Polish pass

### Parallel Strategy (single developer + AI assistant)

- Assign parallel backend sections (T004-T008) to AI agents in parallel
- While backend sections complete, write CLAUDE.md addition (T016)
- Then assign parallel frontend sections (T010-T014) similarly
- Then write worked example and rationale index

---

## Notes

- [P] tasks = independent sections or files, no content dependencies between them
- [Story] label maps each task to its user story for traceability
- No code to write — all tasks produce Markdown content in `ARCHITECTURE.md` or add to `CLAUDE.md`
- Actual file/class names must be verified against the codebase before finalizing (T020)
- The worked example uses a **fictional** "Note" entity — it does not exist in the codebase and should not be implemented
- Commit after Phase 3 completes (US1 deliverable), after Phase 4 completes (US2 deliverable), after Phase 5 completes (US3 deliverable)
