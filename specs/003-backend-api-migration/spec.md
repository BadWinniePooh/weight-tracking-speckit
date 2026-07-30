# Feature Specification: Backend API Migration

**Feature Branch**: `003-backend-api-migration`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User description: "Migrate the weight tracking app from browser localStorage to a persistent backend. Introduce a C# ASP.NET Core REST API and a PostgreSQL database, each running as a separate Docker container. The frontend becomes a thin client — it calls the API for all data operations and contains zero business logic. All domain logic (including chart calculations: trendline, floor line, ceiling line, ideal line) moves to the backend and is returned as pre-computed data ready for the frontend to render. The app must support a single user in this iteration — no authentication yet. The API is openly accessible (auth is deferred to spec 004). A one-time data migration tool must be provided so the user can import existing localStorage data into the database without losing history. All layers must be abstracted via interfaces so that in the future, the database or API implementation can be swapped without touching other layers. Use the repository pattern for data access. The system must be deployable via docker-compose with three containers: frontend (nginx serving static files), backend (ASP.NET Core), database (PostgreSQL). The frontend container must be configurable via environment variable to point to the backend API URL — no hardcoded URLs. Chart settings (weightGoal, lossRate, carbFatRatio, bufferValue) must also migrate from localStorage to the database. The app must remain fully functional on desktop and mobile."

## Clarifications

### Session 2026-03-13

- Q: Should the data model and API be designed for multi-tenancy from the start even though auth is deferred to spec 004? → A: Yes. All user-owned tables (weight entries, chart settings) must include a user_id foreign key from day one. A single default user is seeded at startup and owns all data in this iteration. API middleware resolves the current user — in this iteration it is a stub that always returns the default user and never enforces authentication. Spec 004 will replace the stub with real JWT validation and add user registration, login, and an admin dashboard with zero schema migrations or route restructuring required.
- Q: Where should the unit preference (kg/lbs) be stored after localStorage is removed? → A: As part of the server-side ChartSettings record alongside weightGoal, lossRate, etc. The frontend fetches ChartSettings on load to initialise the unit selector; changing the unit triggers a settings update to the server.
- Q: What CORS policy should the API apply given it has no authentication? → A: Restrict to the configured frontend origin, supplied via an environment variable. No wildcard origins.
- Q: How should container startup ordering and readiness be handled in docker-compose? → A: The backend exposes a health-check endpoint; docker-compose uses it to enforce startup order — backend waits for the database to be healthy, frontend waits for the backend to be healthy.

### Session 2026-03-14

- Q: What architectural pattern must the backend follow for layer separation and dependency direction? → A: Ports and Adapters (Hexagonal Architecture). The Domain project is the application core: domain entities, all port interfaces (IWeightEntryRepository, IChartSettingsRepository, ICurrentUserResolver, IChartCalculationService), and all domain/business logic — it has zero dependencies on Infrastructure or Api. The Infrastructure project contains the adapters: concrete implementations of all port interfaces (EF Core repositories, PostgreSQL, stub user resolver) — it depends on Domain only, never on Api. The Api project is the driving adapter: HTTP endpoint definitions, DI wiring, middleware — it depends on both Domain and Infrastructure but contains no business logic. No cross-layer dependency violations are permitted in any direction.

### Session 2026-03-14 (Implementation Constraints)

- Q: Is TDD mandatory, and what is the required test-first order? → A: TDD is non-negotiable. For every implementation task, a failing test MUST be written first in WeightTracker.Tests. The test must fail before any implementation code is written. Implementation is written only to make the failing test pass. This order must not be skipped or reversed.
- Q: Where must all test files reside? → A: All test files MUST live in WeightTracker.Tests. No file ending in Tests.cs or containing [Fact] or [Theory] is permitted inside WeightTracker.Domain, WeightTracker.Infrastructure, or WeightTracker.Api. Any test file found outside WeightTracker.Tests is a constitution violation.
- Q: What naming convention must test files follow? → A: Test files mirror the project structure of what they test. Example: WeightTracker.Infrastructure/Repositories/UserRepository.cs is tested by WeightTracker.Tests/Integration/Repositories/UserRepositoryTests.cs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log and View Weight Entries (Priority: P1)

As a user, I open the app and it loads all my weight entries from the server. I log a new weight entry using the form and it immediately appears in my history list. All prior entries — including any I logged in past sessions — are present, because data now lives on the server rather than in the browser.

**Why this priority**: This is the core daily interaction. Without persistent read/write of entries, the app has no value.

**Independent Test**: Run the app with a fresh database, log three entries across two browser sessions, verify all three entries appear in session two.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user submits a valid weight value, **Then** the entry is saved to the server and immediately appears at the top of the history list without a page refresh.
2. **Given** the user previously logged entries, **When** they reopen the app in a new browser session, **Then** all prior entries are displayed in newest-first order.
3. **Given** the server is unavailable, **When** the user submits a weight entry, **Then** an error message is shown and no partial data is persisted.
4. **Given** an entry exists, **When** the user deletes it, **Then** the entry is removed from the server and disappears from the history list immediately.
5. **Given** entries exist, **When** the user selects "Delete all", **Then** all entries are removed from the server and the history list shows the empty state.

---

### User Story 2 - Chart Renders from Server-Computed Data (Priority: P2)

As a user, I see the weight trend chart rendered with trendline, floor, ceiling, and ideal corridor lines. All chart calculations have moved to the server — the frontend simply receives pre-computed data points and renders them. Changing the unit preference or chart settings triggers a new request to the server, and the chart re-renders with the returned data.

**Why this priority**: Chart visualisation is the app's primary analytical feature and depends on domain logic now living on the server.

**Independent Test**: Seed the database with 10+ entries, call the chart-data endpoint, verify the response contains data points, trendline, floor, ceiling, and ideal line arrays ready for rendering.

**Acceptance Scenarios**:

1. **Given** fewer than 7 days of data, **When** the chart endpoint is called, **Then** only the raw data points are returned (no corridor lines), and the frontend shows the informational message.
2. **Given** 7+ days of data and a configured weight goal, **When** the chart endpoint is called, **Then** trendline, floor, ceiling, and ideal line data are included in the response.
3. **Given** the user switches the unit from kg to lbs, **When** the chart is refreshed, **Then** the server returns all data converted to lbs and both the chart and history list update consistently.
4. **Given** chart settings are updated (e.g., new weight goal), **When** the settings are saved, **Then** the chart refreshes with recalculated corridor lines reflecting the new values.

---

### User Story 3 - Chart Settings Persist on the Server (Priority: P3)

As a user, I configure my chart settings (weight goal, loss rate, carb/fat ratio, buffer value) via the settings modal. These settings are stored on the server. When I reopen the app in a new session, my settings are restored automatically.

**Why this priority**: Settings persistence completes the data-migration story. Without it, users lose their configuration every session.

**Independent Test**: Configure all four chart settings, close the browser, reopen the app, verify the settings modal pre-populates with the saved values.

**Acceptance Scenarios**:

1. **Given** the user opens the settings modal for the first time, **When** the modal loads, **Then** default values (or previously saved values) are pre-populated.
2. **Given** the user saves new chart settings, **When** they reopen the app, **Then** the settings modal shows the saved values.
3. **Given** invalid values are entered (e.g., negative loss rate), **When** the user tries to save, **Then** inline validation errors are shown and nothing is persisted.

---

### User Story 4 - One-Time Data Migration from Browser Storage (Priority: P4)

As an existing user with weight history in my browser's local storage, I use the in-app migration tool to import that data into the backend database. After migration, all my historical entries and chart settings appear in the app as if they had always been stored on the server. The tool runs once and is clearly labeled as a one-time operation.

**Why this priority**: Preserving history for existing users is important but only relevant to the transition, not ongoing use.

**Independent Test**: Seed browser localStorage with 5 entries and a chart settings object, trigger the migration tool, verify all 5 entries and settings now exist in the database (attributed to the default user) and the tool reports success.

**Acceptance Scenarios**:

1. **Given** localStorage contains valid weight entries, **When** the user triggers the migration tool, **Then** all entries are sent to the server, saved to the database attributed to the default user, and the tool reports the number of records migrated.
2. **Given** localStorage contains chart settings, **When** migration runs, **Then** the chart settings are also migrated and appear in the settings modal.
3. **Given** some localStorage entries are malformed, **When** migration runs, **Then** valid records are migrated, malformed ones are skipped with a warning, and migration does not abort entirely.
4. **Given** the user has already migrated (localStorage is empty), **When** they open the migration tool, **Then** a clear message states there is no data to migrate.

---

### User Story 5 - Deployable via Docker Compose (Priority: P5)

As an operator, I run `docker-compose up` and the full system starts: a database container, a backend API container, and a frontend container. The frontend URL is configurable via an environment variable — no recompilation is needed to point the frontend at a different API host.

**Why this priority**: Deployability gates everything else; the feature is incomplete if it cannot be deployed end-to-end.

**Independent Test**: Run `docker-compose up` on a clean machine, navigate to the frontend URL, log a weight entry, verify it persists after container restart.

**Acceptance Scenarios**:

1. **Given** a machine with Docker and Docker Compose installed, **When** `docker-compose up` is run, **Then** all three containers start in dependency order (database → backend → frontend), the default user is seeded, and the app is accessible in a browser without manual timing or retries.
2. **Given** the API URL environment variable is changed, **When** the frontend container starts, **Then** the frontend communicates with the new API URL without rebuilding the image.
3. **Given** the system is running, **When** the database container is restarted, **Then** all previously stored data is intact (data is persisted to a volume).

---

### Edge Cases

- What happens when the backend is unreachable when the page loads — does the app show a meaningful error rather than a blank screen?
- What happens if the same entry ID is submitted twice during migration (duplicate protection)?
- How does the app behave on a slow mobile connection while waiting for chart data to load — is there a loading indicator?
- What happens if the database runs out of disk space — does the API return a recoverable error to the frontend?
- What happens if a user changes the unit preference while a data request is in-flight?

## Requirements *(mandatory)*

### Functional Requirements

**Data Operations**

- **FR-001**: The system MUST persist all weight entries in a server-side database, not in browser storage.
- **FR-002**: The system MUST expose an endpoint to create a weight entry (value, unit, timestamp).
- **FR-003**: The system MUST expose an endpoint to retrieve all weight entries, sorted newest-first.
- **FR-004**: The system MUST expose an endpoint to delete a single weight entry by ID.
- **FR-005**: The system MUST expose an endpoint to delete all weight entries.
- **FR-006**: The system MUST expose an endpoint to retrieve the current chart settings, including the stored unit preference.
- **FR-007**: The system MUST expose an endpoint to update chart settings, including the unit preference.

**Chart Data**

- **FR-008**: The system MUST expose an endpoint that returns pre-computed chart data (raw data points, trendline, floor line, ceiling line, ideal line) for a given unit preference.
- **FR-009**: The chart-data endpoint MUST return only raw data points when fewer than 7 days of entries exist or no weight goal is configured, with a status indicator explaining why corridor lines are absent.
- **FR-010**: The chart-data endpoint MUST apply unit conversion for all returned values using the unit preference stored in the user's ChartSettings.
- **FR-011**: All domain logic for chart calculations (daily averages, interpolation, corridor computation) MUST reside on the server; the frontend MUST contain no calculation logic.

**Frontend**

- **FR-012**: The frontend MUST call the backend API for all data reads and writes; it MUST NOT access browser storage for weight entries or chart settings.
- **FR-013**: The frontend API base URL MUST be injectable at container startup via an environment variable; the built assets MUST NOT contain a hardcoded URL.
- **FR-014**: The frontend MUST display a loading state while awaiting API responses.
- **FR-015**: The frontend MUST display user-friendly error messages when API calls fail.

**Data Migration**

- **FR-016**: The system MUST provide a one-time migration tool accessible from within the app that reads weight entries and chart settings from browser localStorage and sends them to the backend API.
- **FR-017**: The migration tool MUST report how many records were successfully migrated and how many were skipped due to validation errors.
- **FR-018**: The migration tool MUST be idempotent with respect to duplicates — re-running migration with the same entry MUST NOT create duplicate records in the database.

**Deployment**

- **FR-019**: The system MUST be deployable with a single `docker-compose up` command producing three running containers: frontend, backend, and database.
- **FR-020**: The database MUST use a persistent volume so data survives container restarts.
- **FR-021**: The backend MUST follow the Ports and Adapters (Hexagonal Architecture) pattern: all port interfaces and domain logic reside in the Domain layer; concrete adapter implementations reside in Infrastructure; HTTP endpoint wiring resides in Api.
- **FR-030**: The Domain project MUST have zero compile-time or runtime dependencies on the Infrastructure or Api projects; it MUST be buildable and testable in complete isolation.
- **FR-031**: The Infrastructure project MUST depend only on Domain; it MUST NOT reference the Api project.
- **FR-032**: The Api project MAY depend on both Domain and Infrastructure for DI wiring; it MUST contain no business logic — all domain operations MUST be delegated to interfaces defined in Domain.
- **FR-027**: The backend API MUST restrict cross-origin requests to the configured frontend origin; the allowed origin MUST be supplied via an environment variable and MUST NOT be hardcoded or set to a wildcard.
- **FR-028**: The backend MUST expose a health-check endpoint that reports whether the service is ready to handle requests (including database connectivity).
- **FR-029**: The docker-compose configuration MUST use health-check-based startup ordering: the backend container waits for the database to report healthy before starting; the frontend container waits for the backend to report healthy before starting.

**Testing Discipline**

- **FR-033**: TDD is mandatory for all non-trivial backend logic. A failing test MUST be written in `WeightTracker.Tests` before any implementation code is written. Implementation proceeds only to make the failing test pass. This order MUST NOT be skipped or reversed.
- **FR-034**: All test files MUST reside in `WeightTracker.Tests`. No `.cs` file ending in `Tests.cs` or containing `[Fact]` or `[Theory]` is permitted inside `WeightTracker.Domain`, `WeightTracker.Infrastructure`, or `WeightTracker.Api`. A test file found outside `WeightTracker.Tests` is a constitution violation and MUST be removed.
- **FR-035**: Test file naming MUST mirror the project structure of the file under test. `WeightTracker.Infrastructure/Repositories/Foo.cs` is tested by `WeightTracker.Tests/Integration/Repositories/FooTests.cs`; `WeightTracker.Infrastructure/Services/Bar.cs` is tested by `WeightTracker.Tests/Unit/Services/BarTests.cs`.

**Multi-Tenancy Foundation**

- **FR-022**: All database tables storing user-owned data (weight entries, chart settings) MUST include a user identifier foreign key so the schema is multi-tenant-ready from day one.
- **FR-023**: The backend MUST seed a single default user at startup; all data created in this iteration is owned by that default user.
- **FR-024**: All API routes that access user-owned data MUST resolve the current user via a middleware layer; in this iteration the middleware is a stub that always returns the default user and never enforces credentials.
- **FR-025**: The user-resolution middleware MUST be designed as a replaceable component so that spec 004 can substitute real JWT validation without changing route handlers or repository interfaces.
- **FR-026**: The system MUST NOT require schema migrations or route restructuring when transitioning from the stub middleware to real authentication in spec 004.

### Key Entities

- **User**: An account that owns weight entries and chart settings — identifier, display name. A single default user is seeded at startup. In this iteration no credentials are stored; the entity exists solely to anchor foreign keys and enable spec 004 to add auth without schema changes.
- **WeightEntry**: A single logged measurement owned by a user — identifier, user reference, weight value, unit (kg or lbs), timestamp. Immutable after creation.
- **ChartSettings**: User configuration for corridor calculations and display preferences owned by a user — user reference, preferred unit (kg or lbs), weight goal (optional), loss rate, carb/fat ratio, buffer value. One record per user; updated in place. Seeded with defaults for the default user on first startup.
- **ChartDataSet**: A computed response value — not stored; produced on demand from entries and settings. Contains raw data points plus optional trendline, floor, ceiling, and ideal line arrays, and a corridor-state indicator.
- **DailyAverage**: An intermediate computation — the average weight for a single calendar day, used as input to corridor calculations. Derived; not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All weight entries and chart settings entered in one browser session are visible in a completely separate browser session without any manual sync step.
- **SC-002**: The app loads and displays existing entries and the chart in under 3 seconds on a standard broadband connection.
- **SC-003**: The one-time migration tool successfully transfers 100% of valid localStorage entries to the server database with zero data loss for well-formed records.
- **SC-004**: Changing the unit preference updates both the chart and the history list to the new unit within one round-trip to the server, with no stale values displayed.
- **SC-005**: The full system starts from a clean state with a single command; no manual configuration steps are required beyond setting the API URL environment variable.
- **SC-006**: Restarting any individual container (frontend, backend, or database) does not result in data loss.
- **SC-007**: The app is fully operable on a current-generation mobile browser (form entry, history list scrolling, chart viewing).
- **SC-008**: Transitioning to real authentication in spec 004 requires no database schema migrations and no changes to existing route structure.

## Assumptions

- The unit preference (kg/lbs) is stored as part of ChartSettings on the server. On page load the frontend fetches ChartSettings to initialise the unit selector; changing the unit triggers a settings update before refreshing the chart and history list.
- The migration tool is a browser-side utility that reads localStorage and POSTs to the API; it does not require direct database access.
- "Idempotent migration" is satisfied by matching on the entry's original localStorage-generated ID (UUID) as a stable deduplication key.
- Default chart settings (unit: kg, lossRate: 0.0055, carbFatRatio: 0.6, bufferValue: 0.0075, weightGoal: null) are seeded for the default user on first backend startup if no settings record exists.
- The docker-compose setup is intended for self-hosted / local deployment, not for a production cloud environment.
- The default seeded user requires only an identifier and a display name; no email, password, or credential fields are needed in this iteration (those are added in spec 004).
