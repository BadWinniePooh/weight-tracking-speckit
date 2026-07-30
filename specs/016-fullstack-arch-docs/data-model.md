# Data Model: Full-Stack Architecture Documentation

**Feature**: 016-fullstack-arch-docs
**Date**: 2026-03-18

> This feature produces documentation, not application data. This file defines the **document structure model** — what sections each output file contains, in what order, and what each section must cover.

---

## Output Files

### 1. `ARCHITECTURE.md` (project root)

The primary output artifact. Target audience: human developers and AI coding sessions on demand.

| Section | Purpose | Required |
|---------|---------|----------|
| Overview | One-paragraph project description and architecture philosophy | Yes |
| Repository Structure | Annotated directory tree for backend + frontend | Yes |
| Backend Architecture: Ports & Adapters | Explanation of Domain/Infrastructure/Api separation and rationale | Yes |
| Backend Architecture: Repository Pattern | Interface-in-Domain, implementation-in-Infrastructure convention and rationale | Yes |
| Backend Architecture: Dependency Injection | Scoped service registration in Program.cs; primary constructor injection pattern | Yes |
| Backend Architecture: Auth Flow (JWT + Refresh Tokens) | End-to-end: login → access token → refresh rotation → logout; CurrentUserMiddleware | Yes |
| Backend Architecture: EF Core + Testcontainers | Testing convention: ApiFixture, real PostgreSQL, test naming mirrors source path | Yes |
| Backend: Adding a New Feature (Guidelines) | Per-layer directory table: what file to create, where, what to name it | Yes |
| Frontend Architecture: Module Overview | api-client.ts, auth-guard.ts, auth-token.ts, config.ts, theme.ts — what each does | Yes |
| Frontend Architecture: api-client.ts | Silent-refresh pattern; how to add a new API call | Yes |
| Frontend Architecture: auth-guard.ts | checkAuthStatus() + enforceRedirect() pattern; when and how to call it | Yes |
| Frontend Architecture: Tailwind + DaisyUI | v4 CSS-first config; data-theme; DaisyUI component conventions | Yes |
| Frontend Architecture: Vite Build Setup | Multi-page input map; public/ vs src/; dist/ output | Yes |
| Docker Compose & Runtime Config | Service ordering; health-check gates; envsubst config.json injection; Traefik | Yes |
| Worked Example: Adding a "Note" Entity | Full trace through all 7 layers with concrete file paths and class signatures | Yes |
| Architecture Decisions: Rationale Index | One paragraph per decision: Minimal API, Testcontainers, Ports & Adapters, api-client abstraction | Yes |
| Version Notice | States feature version this doc reflects; instructs reader to check spec files for newer patterns | Yes |

---

### 2. `CLAUDE.md` additions (existing file, project root)

Targeted additions to the existing auto-generated `CLAUDE.md`. Do not replace existing content.

New section to insert before the `<!-- MANUAL ADDITIONS START -->` marker:

**Section name**: `## Architecture Quick Reference (016-fullstack-arch-docs)`

| Subsection | Content |
|------------|---------|
| Backend Layer Placement | 6-row table: file type → project → directory |
| Current User in Endpoints | One-line rule: use `httpContext.Items["CurrentUserId"]`, never raw JWT claims |
| Frontend API Calls | One-line rule: use `request<T>()` from api-client.ts, never raw `fetch()` |
| New Frontend Pages | One-line rule: call `checkAuthStatus()` + `enforceRedirect()` at page load |
| Integration Tests | One-line rule: real PostgreSQL via Testcontainers, no mocks; use `ApiFixture` |
| Reference | Link to `ARCHITECTURE.md` for full context |

---

## Worked Example: "Note" Entity Structure

The worked example traces this fictional entity through all 8 steps (6 new files + 2 modifications to existing files):

| Layer | File | Key Content |
|-------|------|-------------|
| 1. Domain Entity | `WeightTracker.Domain/Entities/Note.cs` | `Id` (Guid), `WeightEntryId` (Guid FK), `UserId` (Guid FK), `Text` (string, max 500), `CreatedAt` (DateTime) |
| 2. Repository Interface | `WeightTracker.Domain/Interfaces/INoteRepository.cs` | `GetByEntryIdAsync(Guid entryId, Guid userId)`, `AddAsync(Note note)`, `DeleteAsync(Guid id, Guid userId)` |
| 3. Repository Implementation | `WeightTracker.Infrastructure/Repositories/NoteRepository.cs` | Implements `INoteRepository`; primary constructor with `AppDbContext`; user-scoped queries |
| 4. EF Core Registration | `WeightTracker.Infrastructure/Data/AppDbContext.cs` | Add `DbSet<Note> Notes`; `OnModelCreating`: FK to WeightEntries, cascade delete, index on (WeightEntryId, UserId) |
| 5. API Endpoint Group | `WeightTracker.Api/Endpoints/NoteEndpoints.cs` | `MapNoteEndpoints()` extension; `GET /api/entries/{entryId}/notes`, `POST /api/entries/{entryId}/notes`, `DELETE /api/entries/{entryId}/notes/{id}`; requires auth; user-scoped via `CurrentUserId` |
| 6. Service Registration | `WeightTracker.Api/Program.cs` | `builder.Services.AddScoped<INoteRepository, NoteRepository>()` |
| 7. Frontend TypeScript Module | `frontend/src/ts/notes.ts` | `fetchNotes(entryId: string)` calling `request<NoteResponse[]>("/api/entries/{entryId}/notes")` from `api-client.ts`; exports typed API functions for use by page scripts |
| 8. Integration Test | `WeightTracker.Tests/Integration/Endpoints/NoteEndpointsTests.cs` | Uses `ApiFixture`; `CreateAuthenticatedClient()`; asserts CRUD operations; no mocks |

---

## Constraints

- `ARCHITECTURE.md` must use actual file names, class names, and method names from the codebase (not invented examples) except in the worked example, which uses the fictional "Note" entity.
- `CLAUDE.md` additions must not duplicate prose that exists in `ARCHITECTURE.md`. Use one-line rules + a link.
- No new source files, configuration changes, or schema changes. This feature produces only documentation files.
