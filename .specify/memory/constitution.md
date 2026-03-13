<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 1.0.0 → 1.1.0
  Modified principles: None — all five principles unchanged
  Added sections: None
  Removed sections: None
  Modified sections:
    - Privacy & Data Standards: resolved TODO(TECH_STACK) — added concrete
      localStorage plaintext guidance, v1 encryption stance, and HTTPS
      deployment responsibility statement
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ No changes needed
    - .specify/templates/spec-template.md ✅ No changes needed
    - .specify/templates/tasks-template.md ✅ No changes needed
  Follow-up TODOs:
    - None — all previously open TODOs resolved.
  Prior deferred items now resolved:
    - TODO(TECH_STACK): Resolved 2026-03-13. Stack confirmed as TypeScript 5.x +
      browser localStorage + nginx:alpine Docker container.
    - TODO(RATIFICATION_DATE): Resolved at v1.0.0 (2026-03-13).
    - C1 (analyze finding): Constitution Principle II data-export MUST is now
      satisfied — US4 (export as CSV/JSON) added to spec.md 2026-03-13.
-->

# Weight Tracking Constitution

## Core Principles

### I. Specification-First

Every feature MUST begin with a written specification (`spec.md`) before any
implementation work starts. Implementation without a signed-off spec is not
permitted. Specs MUST define user stories with acceptance scenarios and measurable
success criteria before the planning phase begins.

**Rationale**: Weight tracking is a personal-health domain. Ambiguous requirements
lead to data model mistakes that are expensive to migrate. Writing the spec first
forces clarity on user intent before any code is written.

### II. Privacy & Data Ownership

Personal health data (weight entries, goals, trends) MUST be treated as sensitive
by default. The system MUST:
- Store data locally or in user-controlled storage unless the user explicitly opts
  into cloud sync.
- Never transmit raw weight data to third-party analytics services.
- Provide a full data-export capability so users own their data.
- Apply input validation on all health metrics to prevent corruption.

**Rationale**: Weight data is personal. Users MUST be able to trust the app with
their data. Violating this principle erodes user trust irreparably.

### III. Test-First (NON-NEGOTIABLE)

TDD is mandatory for all non-trivial logic (data models, calculations, business
rules). The sequence is strictly:

1. Write failing tests that capture the acceptance scenarios.
2. Get approval that the tests reflect the correct behaviour.
3. Tests MUST fail for the right reason.
4. Implement until tests pass.
5. Refactor — keep tests green.

No implementation task is "done" until the acceptance scenarios from the spec
are covered by automated tests.

**Rationale**: Health-metric calculations (BMI, trend lines, goal projections)
MUST be correct. TDD prevents silent regressions and documents expected behaviour
as living tests.

### IV. Incremental Delivery (MVP First)

Features MUST be broken into independently deliverable user-story slices. Each
slice MUST be:
- Implementable without depending on unfinished later slices.
- Testable in isolation.
- Demonstrable to the user.

The P1 user story of every feature MUST constitute a usable MVP. No "big bang"
releases.

**Rationale**: Building the full feature set before any user feedback risks
building the wrong thing. Incremental delivery keeps the feedback loop tight.

### V. Simplicity (YAGNI)

The simplest solution that satisfies the current spec MUST be preferred. Complexity
MUST be justified by a concrete current requirement. Specifically:

- Do NOT add abstractions for hypothetical future requirements.
- Do NOT introduce a new dependency when a standard-library solution exists.
- Do NOT build configurability that no current user story requires.
- Each complexity deviation MUST be documented in the plan's Complexity Tracking
  table with a clear justification.

**Rationale**: Personal-health apps accrete complexity quickly. Keeping solutions
simple reduces maintenance burden and makes the codebase easier to reason about.

## Privacy & Data Standards

- All weight entries and health metrics are classified as **sensitive personal
  data** and MUST be handled accordingly throughout the stack.
- **Storage encryption (v1)**: The current stack uses browser `localStorage`, which
  stores data as plaintext managed by the browser. No additional at-rest encryption
  is applied at the application layer in v1. This is acceptable because: (a) data
  never leaves the user's device, (b) the app is single-user per browser profile,
  and (c) OS-level disk encryption (FileVault, BitLocker, etc.) is the user's
  responsibility. If cloud sync or multi-device features are added in a future
  version, at-rest encryption MUST be revisited before those features ship.
- **Secure transport**: The app is served as static files from an nginx container.
  HTTPS MUST be enforced at the deployment layer (via reverse proxy, load balancer,
  or nginx TLS configuration). The application itself has no server-side code to
  enforce HTTPS, so this is a deployment-time requirement documented in the
  quickstart guide.
- Input validation MUST reject physically implausible values (e.g., weight entries
  outside a configurable but sane range) and surface meaningful errors to the user.
- Data export format MUST be human-readable (CSV or JSON) so users are never
  locked in. The filename MUST include the export date to prevent overwriting prior
  exports (pattern: `weight-entries-YYYY-MM-DD.{csv,json}`).

## Development Workflow

1. **Specify** — Run `/speckit.specify` to create or update `spec.md`.
2. **Clarify** — Run `/speckit.clarify` to resolve ambiguities before planning.
3. **Plan** — Run `/speckit.plan` to generate research, data model, and contracts.
4. **Tasks** — Run `/speckit.tasks` to generate the ordered `tasks.md`.
5. **Implement** — Run `/speckit.implement` to execute tasks one by one.
6. **Analyze** — Run `/speckit.analyze` after task generation to verify
   consistency across all design artifacts.

All pull requests MUST reference the spec that drove the change. The Constitution
Check in `plan.md` MUST be filled out and pass before implementation starts.

## Governance

This constitution supersedes all other ad-hoc development practices for this
project. Any deviation MUST be recorded in the plan's Complexity Tracking table.

**Amendment procedure**:
1. Propose the change with a rationale.
2. Update this file, incrementing the version number per the semver policy below.
3. Propagate changes to affected templates (use `/speckit.constitution` command).
4. Record the amendment date in `Last Amended`.

**Versioning policy**:
- MAJOR: Removal or redefinition of a principle (backward-incompatible governance
  change).
- MINOR: New principle or section added, or materially expanded guidance.
- PATCH: Clarification, wording improvement, or typo fix.

**Compliance review**: Each feature's `plan.md` Constitution Check section serves
as the per-feature compliance gate. Reviews MUST verify all five principles before
approving a feature for implementation.

**Version**: 1.1.0 | **Ratified**: 2026-03-13 | **Last Amended**: 2026-03-13
