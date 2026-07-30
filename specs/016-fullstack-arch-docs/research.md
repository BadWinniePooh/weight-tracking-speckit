# Research: Full-Stack Architecture Documentation

**Feature**: 016-fullstack-arch-docs
**Date**: 2026-03-18

---

## Decision 1: Output File Structure

**Question**: Should the output be a single `ARCHITECTURE.md`, split doc files, or a combination of `ARCHITECTURE.md` + targeted `CLAUDE.md` additions?

### Options Evaluated

**Option A — Single `ARCHITECTURE.md`**
- Pros: Simple, immediately findable, easy to link, GitHubrenderable in one click, easy to pass as context to an AI session explicitly.
- Cons: Does not auto-load into Claude Code sessions. AI assistants must be explicitly instructed to read it every session. Risk: it gets skipped.

**Option B — Split doc files (e.g., `docs/backend-patterns.md`, `docs/frontend-patterns.md`)**
- Pros: Each file stays focused on its domain.
- Cons: Increases navigation overhead. No clear benefit over a single well-structured file. Violates YAGNI — no evidence that file size is a problem for a single `ARCHITECTURE.md`. Harder to use as AI context (must load multiple files).

**Option C — `ARCHITECTURE.md` + targeted `CLAUDE.md` additions (RECOMMENDED)**
- Pros:
  - `ARCHITECTURE.md` is the authoritative, comprehensive reference for human developers. Full context, full worked example, rationale for every pattern.
  - `CLAUDE.md` is auto-loaded into every Claude Code session. Adding a concise "Architecture Quick Reference" section there means the most critical AI-guidance rules are always in context — zero friction.
  - The two files serve different purposes without duplicating content: CLAUDE.md gets the compact, action-oriented rules; ARCHITECTURE.md gets the full explanation.
- Cons: Two files to maintain. Drift risk if one is updated without the other.
- Mitigation: CLAUDE.md additions should be explicit cross-references to ARCHITECTURE.md for depth, not a copy of the same content.

**Decision: Option C**

**Rationale**: Claude Code auto-loads `CLAUDE.md` into every session. This is the highest-value AI context injection point in the codebase. A compact "Architecture Quick Reference" section there — covering layer placement rules, naming conventions, the `CurrentUserMiddleware` pattern, and the frontend `request<T>()` convention — will be in context for every session without any explicit action. `ARCHITECTURE.md` serves the human developer and the AI when deeper reference is needed. These serve different purposes and should not be collapsed.

---

## Decision 2: What Goes in CLAUDE.md vs ARCHITECTURE.md

### CLAUDE.md additions (compact, action-oriented, always auto-loaded)

Add a new section: `## Architecture Quick Reference (016-fullstack-arch-docs)` containing:

1. **Layer placement rules** (one line each):
   - New entities → `WeightTracker.Domain/Entities/`
   - New repository interfaces → `WeightTracker.Domain/Interfaces/`
   - Repository implementations → `WeightTracker.Infrastructure/Repositories/`
   - New services → interface in Domain, implementation in Infrastructure, registered Scoped in `Program.cs`
   - New endpoints → `WeightTracker.Api/Endpoints/` as `MapXxxEndpoints()` extension method
   - New tests → `WeightTracker.Tests/Integration/` or `Tests/Unit/`, mirroring source path

2. **Current user in endpoints**: Always use `httpContext.Items["CurrentUserId"]` (set by `CurrentUserMiddleware`) — never read JWT claims directly in endpoint handlers.

3. **Frontend API calls**: Always use `api-client.ts` `request<T>()` helper — never raw `fetch()` — to inherit silent token refresh.

4. **New frontend pages**: Call `checkAuthStatus()` + `enforceRedirect()` from `auth-guard.ts` at page load before rendering protected content.

5. **Integration tests**: Extend `ApiFixture` / use class fixture. Use `CreateAuthenticatedClient()`. No database mocks — real PostgreSQL via Testcontainers.

6. **Link**: See `ARCHITECTURE.md` for full rationale, patterns, and worked example.

### ARCHITECTURE.md (comprehensive, human-readable reference)

Full content including:
- All architectural patterns with explanation and rationale
- Concrete implementation guidelines (per-layer directory tables)
- JWT + Refresh Token auth flow (sequence diagram in prose)
- EF Core + Testcontainers testing convention
- Frontend module guide (api-client, auth-guard, auth-token, config, theme)
- Tailwind CSS v4 + DaisyUI v5 conventions
- Vite multi-page build setup
- Docker Compose orchestration model
- Full worked example: fictional "Note" entity through all 7 layers

---

## Decision 3: Worked Example Subject

**Question**: What fictional entity makes the best worked example?

**Options considered**:
- "Note" (freetext note attached to a weight entry): Simple, one-to-many relationship, covers all layers without excess complexity. Does not overlap with any existing entity.
- "Goal" (target weight goal): Already partially implied by existing `ChartSettings`. Risk of confusion.
- "Tag" (user-defined label for entries): Many-to-many relationship — adds join table complexity that obscures the basic pattern.

**Decision: "Note" entity**

A `Note` is a short text string attached to a weight entry. It has a clear owner (User), a parent (WeightEntry), and simple CRUD operations. It exercises all seven layers without introducing complexity that obscures the pattern being documented.

---

## Decision 4: ARCHITECTURE.md Placement and Format

**Location**: Project root (`ARCHITECTURE.md`) — same level as `CLAUDE.md`, `README.md`, `docker-compose.yml`. Immediately visible to any developer opening the repository.

**Format**: GitHub Flavored Markdown with:
- Section headers matching the spec requirements
- Code blocks for file path examples, class signatures, and endpoint patterns
- Prose sequence description for auth flow (no external diagram dependency)
- Tables for layer placement quick reference

**Length guidance**: Comprehensive but not exhaustive. Each section answers "what goes here, why, and how" in the minimum words that leave nothing ambiguous. Aim for ~600-900 lines of Markdown.

---

## Summary of All Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Output structure | Option C: `ARCHITECTURE.md` + `CLAUDE.md` additions | Different audiences; CLAUDE.md auto-loads; no content duplication |
| CLAUDE.md content | Compact quick-reference (layer rules + critical patterns) + link | Always in AI context; avoids bloating CLAUDE.md |
| ARCHITECTURE.md content | Full reference: patterns + rationale + worked example | Complete human reference; AI reads on demand |
| Worked example entity | "Note" (text attached to WeightEntry) | Simple one-to-many; covers all layers; no overlap with existing entities |
| ARCHITECTURE.md location | Project root | Immediately discoverable |
