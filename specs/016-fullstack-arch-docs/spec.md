# Feature Specification: Full-Stack Architecture Documentation

**Feature Branch**: `016-fullstack-arch-docs`
**Created**: 2026-03-18
**Status**: Draft
**Input**: User description: "Create comprehensive architecture documentation for the full stack (backend + frontend) that serves both human developers and AI coding sessions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New Developer Onboards Without Guidance (Priority: P1)

A developer joining the project for the first time has no access to the original author. They must be able to read the architecture documentation and independently understand: where code lives, how layers communicate, how authentication works end-to-end, and how to write a test that will pass in CI. Within one working session, they should be able to correctly place new code and submit a change that follows all established conventions.

**Why this priority**: Without this, every new contributor (human or AI) risks violating layering rules, writing untestable code, or bypassing established auth patterns. This is the primary value of the documentation.

**Independent Test**: Can be tested by giving the documentation (without access to the codebase) to a developer and asking them to describe where a new API endpoint for "exporting weight entries as CSV" would live, what interfaces to create, and how the integration test would be structured. Their answer should match actual project conventions.

**Acceptance Scenarios**:

1. **Given** a developer has only read the architecture documentation, **When** they are asked "where do I add a new repository interface?", **Then** they correctly identify the Domain project and name the interface convention (e.g., `IFooRepository`).
2. **Given** a developer reads the documentation, **When** they are asked how to write an integration test for a new endpoint, **Then** they describe using the test fixture with a real PostgreSQL container — not mocks — and placing the test in the correct directory mirroring the feature's project path.
3. **Given** a developer reads the documentation, **When** they must add a new authenticated frontend page, **Then** they correctly identify the auth-guard and enforceRedirect pattern and know to check auth status before rendering protected content.

---

### User Story 2 - AI Coding Session Uses Docs as Authoritative Context (Priority: P2)

An AI coding assistant is given the architecture documentation as context at the start of a session. The AI must be able to correctly infer where new code belongs at each layer, what naming conventions to follow, and what patterns to replicate — without needing to read every existing file first.

**Why this priority**: AI sessions have limited context windows. If the architecture documentation is dense and precise enough, the AI can generate correctly-structured code on the first attempt, avoiding costly correction loops.

**Independent Test**: Can be tested by providing only the documentation (no codebase access) to an AI session and asking it to scaffold a new `ChartExportRepository` with its interface, implementation, and an integration test stub. The output should be structurally correct: interface in Domain, implementation in Infrastructure, test in the Integration/Repositories directory, registered as Scoped in the Api project.

**Acceptance Scenarios**:

1. **Given** the documentation is loaded as context, **When** the AI is asked to add a new service, **Then** it places the interface in Domain, the implementation in Infrastructure, and registers it as Scoped in the Api project — without prompting.
2. **Given** the documentation describes the JWT + Refresh Token flow, **When** the AI adds a new protected endpoint, **Then** it correctly uses the middleware-populated current user identifier (not raw JWT claims) for user-scoped data access.
3. **Given** the documentation covers the frontend api-client pattern, **When** the AI adds a new API call on the frontend, **Then** it uses the shared request helper (not raw fetch) so that silent token refresh is inherited automatically.

---

### User Story 3 - Developer Adds a Feature Using Documentation as Blueprint (Priority: P3)

An experienced developer already familiar with the technology stack but new to this specific codebase uses the documentation as a step-by-step blueprint for adding a non-trivial feature. The documentation should answer all structural questions so they never need to reverse-engineer an existing feature to understand where things go.

**Why this priority**: Reduces knowledge-transfer overhead and prevents architectural drift as the project grows.

**Independent Test**: Can be tested by asking the developer to enumerate the complete file list they would create for a new "Meals" feature. They should correctly list the domain entity, repository interface, infrastructure implementation, API endpoint group file, frontend TypeScript module, and integration test class — in the correct directories — from documentation alone.

**Acceptance Scenarios**:

1. **Given** the documentation's "adding new features" section, **When** a developer lists files to create for a new domain entity, **Then** the list matches the established pattern with no omissions (entity, interface, implementation, API group, test).
2. **Given** the documentation covers the rationale sections, **When** a developer is asked "why don't we use controller classes?", **Then** they can articulate the reasoning without reading any code.
3. **Given** the documentation covers the frontend styling conventions, **When** a developer adds a new page, **Then** the page uses theme inheritance, DaisyUI component classes, and initializes the theme module — matching existing pages.

---

### Edge Cases

- What happens when the documentation becomes stale as the codebase evolves? The document must note the feature version it reflects and instruct readers to check recent spec files for newer patterns introduced after that point.
- How does the documentation handle features that cross multiple layers simultaneously? It must provide a concrete worked example that traces a single fictional feature end-to-end through every layer to answer this.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Documentation MUST name and explain all architectural patterns in use: Ports & Adapters (Domain/Infrastructure/Api layering), Repository pattern, JWT + Refresh Token auth flow, and the EF Core + Testcontainers integration testing convention.
- **FR-002**: Documentation MUST include concrete implementation guidelines — which directory and project each new file type belongs in, what naming conventions apply, and what the registration step in the Api project looks like for new services and repositories.
- **FR-003**: Documentation MUST document the rationale for each key architectural decision: Minimal API over MVC controllers, Testcontainers over database mocks, the Ports & Adapters boundary, and the frontend api-client/auth-guard abstraction layer.
- **FR-004**: Documentation MUST cover the complete frontend architecture: the api-client silent-refresh pattern, the auth-guard auth-state-and-redirect pattern, in-memory token storage, runtime API URL injection, the Tailwind CSS + DaisyUI styling approach, and the Vite multi-page build setup.
- **FR-005**: Documentation MUST include a worked end-to-end example tracing a single fictional feature through all eight steps: (1) Domain entity, (2) repository interface, (3) repository implementation, (4) EF Core DbSet + OnModelCreating update, (5) API endpoint group, (6) Program.cs Scoped registration, (7) frontend TypeScript module for calling the new API, (8) integration test — with concrete file paths, class names, and method signatures. Note: steps 1–3, 5, 7–8 produce new files; steps 4 and 6 modify existing files.
- **FR-006**: Documentation MUST be precise enough to serve as AI context — self-contained, unambiguous, and using terminology that exactly matches the actual codebase (file names, class names, method names, directory paths).
- **FR-007**: Documentation MUST be readable for a new human developer — each pattern must explain why it exists, not just what it is, and must not assume prior knowledge of the specific project.
- **FR-008**: Documentation MUST cover the Docker Compose orchestration model: service ordering, health-check gates, Traefik integration, and runtime environment variable injection.
- **FR-009**: Documentation MUST include the auth flow end-to-end: login response structure, access token lifetime, refresh token rotation, HTTP-only cookie transport, and the middleware pattern for extracting user identity in endpoint handlers.

### Key Entities

- **Architecture Document**: A Markdown file describing patterns, guidelines, rationale, and examples. Target audience: human developers and AI coding assistants. Scope: the entire weight-tracking project as of feature 016.
- **Worked Example**: A concrete, fully-specified example of adding a new feature that exercises every layer. Must be fictitious enough to not overlap with existing features but realistic enough to be directly instructive.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with no prior project knowledge can correctly identify the location and naming convention for any new file type (entity, repository interface, implementation, endpoint group, test class, frontend module) using only the documentation — validated by a "where does this go?" quiz with 100% correct answers for all six file types.
- **SC-002**: An AI coding session given only the documentation (no codebase access) produces a correctly-structured scaffold for a new feature (interface in Domain, implementation in Infrastructure, Scoped registration in Api, test in the Tests project) on the first attempt without corrections.
- **SC-003**: The documentation answers "why?" for every major architectural pattern — a reader can explain the rationale for Minimal API, Testcontainers, Ports & Adapters, and the frontend auth abstraction without reading any code.
- **SC-004**: The documentation is fully self-contained: no section requires reading another file to understand a concept. All cross-references are explicit.
- **SC-005**: The worked end-to-end example covers all eight steps — (1) Domain entity, (2) repository interface, (3) repository implementation, (4) EF Core DbSet + OnModelCreating update, (5) API endpoint group, (6) Program.cs Scoped registration, (7) frontend TypeScript module for calling the new API, (8) integration test — with concrete file paths and class names, leaving no structural questions unanswered.

---

## Assumptions

- The documentation will be produced as a single Markdown file (`ARCHITECTURE.md`) at the project root, making it easy to include as context in AI sessions and discoverable for new contributors.
- The "worked example" will use a fictional "Note" entity (attaching a freetext note to a weight entry) — simple enough not to obscure the pattern, complex enough to exercise all layers.
- The documentation describes the architecture as of feature 016 (PWA support). Future features may introduce new patterns and should update or supplement this document.
- The document will use the actual file names, class names, and method names from the codebase to maximize precision for AI context use.
