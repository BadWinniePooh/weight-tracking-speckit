# Feature Specification: Documentation Overhaul

**Feature Branch**: `012-docs-overhaul`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Documentation overhaul for a self-hosted weight tracking application targeting self-hosters and developers. Files: README.md (rewrite), docs/deployment.md (new), docs/architecture.md (new), docs/backup.md (new), docs/runbook.md (update). Constraint: single source of truth — each piece of information lives in exactly one file."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Self-hoster deploys from scratch (Priority: P1)

A person who wants to run the weight tracker on their own server finds the project on GitHub. They read the README, follow the quick-start steps, and have the application running — or know exactly where to go for the complete deployment guide. If they need TLS termination via a reverse proxy, they can find those instructions without leaving the documentation set.

**Why this priority**: First contact with the project. If a self-hoster cannot find a working path from README to running app in one sitting, the project loses them. This is the most common use case.

**Independent Test**: A person with no prior knowledge of the project can read `README.md`, click through to `docs/deployment.md`, and reach a running application (or a clear next action) without consulting any source outside those two documents.

**Acceptance Scenarios**:

1. **Given** a visitor arrives at the GitHub repository, **When** they read `README.md`, **Then** they see what the application does, a 3–5 step quick-start, and clearly labeled links to `docs/deployment.md` for full deployment detail.
2. **Given** a self-hoster opens `docs/deployment.md`, **When** they follow it top to bottom, **Then** they encounter all prerequisites, a complete environment variable reference, Docker Compose startup instructions, Traefik TLS configuration, and first-run wizard instructions — without needing to consult any other file to complete a standard deployment.
3. **Given** a self-hoster needs backup or restore procedures, **When** they follow a link from `docs/deployment.md`, **Then** they land in `docs/backup.md` and find complete, self-contained instructions.

---

### User Story 2 - Developer understands the system architecture (Priority: P2)

A developer (contributor or evaluator) wants to understand how the system is structured before modifying or extending it. They open `docs/architecture.md` and come away with a clear mental model of the components, how they interact, the technology choices, and the data model — supported by diagrams, not ASCII art.

**Why this priority**: Without architectural documentation, every new contributor must reverse-engineer the system. This blocks contributions and increases the risk of changes that break implicit contracts between components.

**Independent Test**: A developer who has not previously read the codebase can open `docs/architecture.md` and correctly describe the component boundaries, request flow, and key data entities — without reading any source code.

**Acceptance Scenarios**:

1. **Given** a developer opens `docs/architecture.md`, **When** they read the system overview section, **Then** they find a MermaidJS or PlantUML diagram showing all major components and their relationships — no ASCII art.
2. **Given** a developer reads the data model section, **When** they examine the diagram, **Then** they see the key entities and their relationships rendered as a proper diagram (MermaidJS or PlantUML).
3. **Given** a developer wants to understand technology choices, **When** they read the tech stack section, **Then** each major technology is listed with a brief rationale for why it was chosen.

---

### User Story 3 - Operator maintains a running instance (Priority: P3)

An operator responsible for an already-deployed instance needs to perform a health check, apply an upgrade, diagnose a problem, or roll back a failed update. They open `docs/runbook.md` and find focused operational procedures — no setup duplication, no embedded backup instructions, just operations.

**Why this priority**: Operators working under pressure (outage, failed upgrade) need a tight, non-duplicated reference. Duplication across files creates dangerous drift and wasted time.

**Independent Test**: An operator can open `docs/runbook.md` exclusively and complete a health check, a version upgrade, and a rollback. Backup and restore are intentionally absent — the file contains a clearly visible link to `docs/backup.md`.

**Acceptance Scenarios**:

1. **Given** `docs/runbook.md` is open, **When** an operator searches for "backup" or "restore", **Then** they find a link to `docs/backup.md` — not inline backup instructions.
2. **Given** `docs/runbook.md` is open, **When** an operator looks for configuration or initial setup steps, **Then** those are absent — a link to `docs/deployment.md` is provided instead.
3. **Given** an operator encounters a common failure mode, **When** they consult the troubleshooting section, **Then** each problem has a clear diagnosis step and a resolution step with no content duplicated from `docs/deployment.md`.

---

### Edge Cases

- What if a reader only reads the README and skips linked docs? — The quick-start must be self-contained enough for a minimal local deployment; links to deeper docs must describe what readers will find there.
- What if `docs/runbook.md` currently contains content that duplicates `docs/deployment.md`? — That content is removed from `docs/runbook.md` and replaced with a cross-reference link; canonical content stays in `docs/deployment.md`.
- What if the same fact (e.g., an environment variable name) would naturally appear in multiple files? — It has exactly one canonical home; all other files reference it by hyperlink.
- What if a link between documentation files breaks? — All cross-file references use relative hyperlinks that can be verified without a live server.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `README.md` MUST describe what the application is and who it is for in no more than three short paragraphs at the top of the file.
- **FR-002**: `README.md` MUST include a quick-start section of 3–5 numbered steps sufficient for a minimal local deployment.
- **FR-003**: `README.md` MUST contain clearly labeled links to `docs/deployment.md`, `docs/architecture.md`, and `docs/runbook.md`; it MUST NOT repeat content that belongs in those files.
- **FR-004**: `docs/deployment.md` MUST cover, in sequence: prerequisites, a complete environment variable reference table (name, description, required/optional, example value), Docker Compose startup, Traefik TLS configuration, and first-run wizard instructions.
- **FR-005**: `docs/deployment.md` MUST link to `docs/backup.md` for backup and restore — it MUST NOT contain inline backup or restore procedures.
- **FR-006**: `docs/architecture.md` MUST include at least one system-component diagram and at least one data-model diagram; both MUST use MermaidJS or PlantUML syntax — ASCII art is not permitted anywhere in the file.
- **FR-007**: `docs/architecture.md` MUST describe the technology stack with a brief rationale for each major technology choice.
- **FR-008**: `docs/backup.md` MUST be a standalone document containing all backup and restore procedures for the Docker-volume–based database setup.
- **FR-009**: `docs/backup.md` MUST cover three distinct, numbered procedures: creating a backup, verifying a backup, and restoring from a backup.
- **FR-010**: `docs/runbook.md` MUST NOT contain any backup or restore procedures; it MUST contain a prominent link to `docs/backup.md`.
- **FR-011**: `docs/runbook.md` MUST NOT duplicate any configuration or initial setup content from `docs/deployment.md`; cross-references by link are permitted.
- **FR-012**: `docs/runbook.md` MUST cover health checks, version upgrades, rollbacks, and a troubleshooting section for common failure modes.
- **FR-013**: `docs/design-system.md` MUST NOT be modified.
- **FR-014**: No application source code files MUST be created or modified as part of this feature — documentation files only.
- **FR-015**: Every piece of operational or technical information MUST exist in exactly one file; all other files MUST reference it by hyperlink rather than repeating it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person with no prior knowledge of the project can complete a local deployment by following only `README.md` and `docs/deployment.md`, without consulting any external resource or opening any source file.
- **SC-002**: Zero pieces of content are duplicated across the five documentation files in scope — verified by a manual review finding no section repeated in more than one file.
- **SC-003**: Every diagram in the documentation set renders as a visual diagram (not a code block) in a standard Markdown renderer that supports MermaidJS or PlantUML — zero ASCII diagrams remain.
- **SC-004**: A developer unfamiliar with the codebase can correctly describe the system's major components and data entities after reading only `docs/architecture.md`.
- **SC-005**: `docs/runbook.md` contains no backup or restore content; a reader looking for those procedures finds a link to `docs/backup.md` within the first scan of the file.
- **SC-006**: All cross-references between the five documentation files use working relative hyperlinks — zero broken links.

## Assumptions

- The existing `docs/runbook.md` contains backup/restore and deployment content that will be extracted and relocated; the file is updated, not deleted.
- "Traefik TLS configuration" means documenting how Traefik acts as a reverse proxy for the application with HTTPS termination — not a full Traefik installation guide.
- The documentation targets readers comfortable with a terminal, Docker, and basic networking; step-by-step explanations of Docker basics are out of scope.
- No screenshots are required; feature summaries in `README.md` may use prose or a bullet list.
- `docs/design-system.md` is explicitly out of scope and will not be linked to from the new documentation unless a link already existed.
- A "working relative hyperlink" means a path that resolves correctly when viewed on GitHub or a local Markdown renderer — no absolute URLs required.
