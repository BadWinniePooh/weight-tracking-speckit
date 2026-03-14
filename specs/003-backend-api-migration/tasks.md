# Tasks: Backend API Migration (003)

**Input**: Design documents from `/specs/003-backend-api-migration/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/api.md ✅, research.md ✅, quickstart.md ✅

**Tests**: Included — TDD is mandatory per the constitution check in plan.md. Backend integration tests for all endpoints and `ChartCalculationService` unit tests are written before their implementations.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies in this phase)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup

**Purpose**: Create the backend solution structure, configure projects, and install dependencies.

- [ ] T001 Create the backend solution: `backend/WeightTracker.sln` with four .NET 8 projects (`WeightTracker.Domain`, `WeightTracker.Infrastructure`, `WeightTracker.Api`, `WeightTracker.Tests`) wired with project references that enforce the Ports and Adapters rules (Domain has zero refs; Infrastructure refs Domain only; Api refs Domain + Infrastructure; Tests refs all three) in backend/
- [ ] T002 [P] Add NuGet packages to `WeightTracker.Infrastructure` (`Microsoft.EntityFrameworkCore` 8.x, `Npgsql.EntityFrameworkCore.PostgreSQL` 8.x) and to `WeightTracker.Api` (`Microsoft.AspNetCore.Diagnostics.HealthChecks`) in backend/WeightTracker.Infrastructure/ and backend/WeightTracker.Api/
- [ ] T003 [P] Add NuGet packages to `WeightTracker.Tests` (`xunit`, `xunit.runner.visualstudio`, `Microsoft.AspNetCore.Mvc.Testing`, `Testcontainers.PostgreSql`, `coverlet.collector`) in backend/WeightTracker.Tests/WeightTracker.Tests.csproj

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain layer, database context, EF Core migration, seeding, user-resolver middleware, health endpoint, and full `Program.cs` wiring. No user story can be implemented until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 [P] Create domain entities `User.cs` (Id UUID, DisplayName varchar(100), CreatedAt timestamptz), `WeightEntry.cs` (Id UUID, UserId UUID FK, WeightValue decimal(10,4), Unit varchar(3), Timestamp timestamptz, CreatedAt timestamptz), `ChartSettings.cs` (Id UUID, UserId UUID UNIQUE, PreferredUnit varchar(3), WeightGoal decimal(10,4) nullable, LossRate decimal(10,6), CarbFatRatio decimal(10,6), BufferValue decimal(10,6), UpdatedAt timestamptz) exactly as defined in data-model.md in backend/WeightTracker.Domain/Entities/
- [ ] T005 [P] Create domain models `ChartDataSet.cs` (CorridorState string enum, Unit string, DataPoints ChartPoint[], Trendline/Floor/Ceiling/Ideal nullable ChartPoint[]), `DailyAverage.cs` (Date, DayIndex, AvgWeight, Origin enum: Measured/Interpolated), and `ChartPoint.cs` (Date string, Value decimal) in backend/WeightTracker.Domain/Models/
- [ ] T006 [P] Create repository interfaces `IWeightEntryRepository.cs` (GetAllAsync, AddAsync, DeleteAsync, DeleteAllAsync), `IChartSettingsRepository.cs` (GetByUserAsync, UpsertAsync), `IUserRepository.cs` (GetByIdAsync, AddAsync) in backend/WeightTracker.Domain/Interfaces/Repositories/
- [ ] T007 [P] Create service interfaces `IChartCalculationService.cs` (ComputeChartDataAsync(Guid userId, string unit): Task<ChartDataSet>) and `ICurrentUserResolver.cs` (GetCurrentUserId(): Guid) in backend/WeightTracker.Domain/Interfaces/Services/
- [ ] T008 Implement `AppDbContext` with EF Core Fluent API configuration for all three entities: primary keys, FK relationships, CHECK constraints for Unit/PreferredUnit (IN ('kg','lbs')), decimal precision decimal(10,4) and decimal(10,6), UNIQUE index on ChartSettings.UserId, composite B-tree index (UserId, Timestamp DESC) on WeightEntries in backend/WeightTracker.Infrastructure/Data/AppDbContext.cs
- [ ] T009 Generate the initial EF Core migration (`InitialCreate`) producing `Users`, `WeightEntries`, `ChartSettings` tables with all constraints and indexes defined in T008; verify `dotnet ef migrations add InitialCreate` succeeds in backend/WeightTracker.Infrastructure/Data/Migrations/
- [ ] T010 [P] Implement `UserRepository` (GetByIdAsync(Guid id), AddAsync(User user)) in backend/WeightTracker.Infrastructure/Repositories/UserRepository.cs
- [ ] T011 [P] Implement `DatabaseSeeder` with idempotent logic: check for default user (Id = 00000000-0000-0000-0000-000000000001); if absent insert with DisplayName = "Default User"; then check for a ChartSettings record for that user; if absent insert with seeded defaults (PreferredUnit='kg', WeightGoal=null, LossRate=0.005500, CarbFatRatio=0.600000, BufferValue=0.007500) in backend/WeightTracker.Infrastructure/Seeding/DatabaseSeeder.cs
- [ ] T012 [P] Implement `StubCurrentUserResolver` (returns Guid.Parse("00000000-0000-0000-0000-000000000001") from GetCurrentUserId()) and `CurrentUserMiddleware` that calls ICurrentUserResolver.GetCurrentUserId() and writes the result to HttpContext.Items["CurrentUserId"] before passing to the next delegate in backend/WeightTracker.Infrastructure/Services/StubCurrentUserResolver.cs
- [ ] T013 Implement `HealthEndpoints` extension method `MapHealthEndpoints()` registering `GET /health`; handler calls IHealthCheckService.CheckHealthAsync(), maps result to `{ "status": "Healthy"|"Unhealthy", "checks": { "database": "Healthy"|"Unhealthy" } }`, returns 200 OK or 503 Service Unavailable as specified in contracts/api.md in backend/WeightTracker.Api/Endpoints/HealthEndpoints.cs
- [ ] T014 Wire `Program.cs`: read ConnectionStrings__DefaultConnection and ALLOWED_ORIGIN env vars; register EF Core + Npgsql; add ASP.NET Core health checks with PostgreSQL connectivity check; register ICurrentUserResolver/StubCurrentUserResolver and IUserRepository/UserRepository; add CORS policy restricted to ALLOWED_ORIGIN; run await context.Database.MigrateAsync() in a 30-retry x 1-second loop; call DatabaseSeeder.SeedAsync(); add CurrentUserMiddleware; call app.MapHealthEndpoints(); create appsettings.json with placeholder connection string in backend/WeightTracker.Api/Program.cs and backend/WeightTracker.Api/appsettings.json
- [ ] T015 Create `ApiFixture.cs` extending `WebApplicationFactory<Program>` that starts a real PostgreSQL instance via Testcontainers, overrides ConnectionStrings__DefaultConnection and ALLOWED_ORIGIN in the test app configuration, and exposes a pre-seeded HttpClient for all integration tests in backend/WeightTracker.Tests/Integration/Fixtures/ApiFixture.cs

**Checkpoint**: Run `docker-compose up db` then `dotnet run` from `backend/WeightTracker.Api/`. `GET /health` must return `{ "status": "Healthy", "checks": { "database": "Healthy" } }`. All four projects build with zero errors.

---

## Phase 3: User Story 1 — Log and View Weight Entries (Priority: P1) 🎯 MVP

**Goal**: Full entry CRUD via the backend API; frontend replaces all localStorage entry access with API calls and displays meaningful loading and error states.

**Independent Test**: Start with a fresh database. Open the app in Browser A, log three entries on different days. Open a fresh Browser B session; all three entries are present in the history list, newest-first.

> **TDD**: Write T016 first and confirm all tests FAIL before implementing T017–T023.

### Tests — write first, must FAIL before implementation

- [ ] T016 [US1] Write failing integration tests covering all four entry endpoints: `GET /api/entries` (empty array when no entries; populated array newest-first after inserts), `POST /api/entries` (201 with created entry; 400 for out-of-range value; 400 for invalid unit; 201 on duplicate ID with existing entry returned unchanged), `DELETE /api/entries/{id}` (204 on success; 404 for unknown ID), `DELETE /api/entries` (204 whether entries exist or not) in backend/WeightTracker.Tests/Integration/Endpoints/EntryEndpointsTests.cs

### Implementation

- [ ] T017 [P] [US1] Implement `WeightEntryRepository`: GetAllAsync(Guid userId) sorted Timestamp DESC, AddAsync with insert-or-skip on duplicate Id (return existing row if Id already exists), DeleteAsync(Guid id, Guid userId) returning bool (false if not found or wrong user), DeleteAllAsync(Guid userId) in backend/WeightTracker.Infrastructure/Repositories/WeightEntryRepository.cs
- [ ] T018 [P] [US1] Implement `EntryEndpoints` extension method `MapEntryEndpoints()` wiring all four routes; each handler reads CurrentUserId from HttpContext.Items["CurrentUserId"]; POST validates weight range (kg: 1–635, lbs: 2–1400) and unit before persisting; returns shapes matching contracts/api.md exactly in backend/WeightTracker.Api/Endpoints/EntryEndpoints.cs
- [ ] T019 [US1] Register IWeightEntryRepository/WeightEntryRepository in DI and call app.MapEntryEndpoints() in backend/WeightTracker.Api/Program.cs
- [ ] T020 [P] [US1] Implement `src/ts/config.ts` exporting loadConfig(): Promise<void> (fetches /config.json and caches the result) and getApiUrl(): string (returns cached API base URL, throws if loadConfig not called first) in src/ts/config.ts
- [ ] T021 [P] [US1] Implement `src/ts/api-client.ts` with typed fetch wrappers for entry operations: getEntries(): Promise<EntryListResponse>, createEntry(payload): Promise<EntryResponse>, deleteEntry(id: string): Promise<void>, deleteAllEntries(): Promise<void>; all wrappers prepend getApiUrl() to paths and throw a typed ApiError (with message and optional field) for non-2xx responses in src/ts/api-client.ts
- [ ] T053 [P] [US1] Update `src/ts/model.ts` to align with API response shapes: change `ChartPoint.date` from `Date` to `string` to match the API's `"YYYY-MM-DD"` string format; add `preferredUnit: string` to the `ChartSettings` interface; remove `UserPreferences` interface (unit preference now in ChartSettings); remove `createEntry()` helper (server owns entry creation); remove `DailyAverage` and the existing frontend `ChartDataSet` interface (both are server-side only); export API-compatible `ChartDataSet` and `ChartPoint` interfaces matching the shapes returned by `GET /api/chart`; retain `WeightEntry`, `WeightUnit`, `validateWeight()`, and `ValidationResult` unchanged — this task is a prerequisite for T031 (chart.ts update) and T036 (api-client settings types) in src/ts/model.ts
- [ ] T022 [US1] Rewrite `src/ts/main.ts` and update `src/ts/export.ts`: in main.ts, call await loadConfig() as the very first async action before any DOM initialisation; replace all localStorage reads/writes for weight entries with api-client calls (getEntries() on load, createEntry() on form submit, deleteEntry()/deleteAllEntries() on delete actions); re-render history list from API response; in export.ts, update the export button handler to call `getEntries()` from api-client (fetching from GET /api/entries) instead of using localStorage-sourced data, preserving the CSV and JSON download functionality with constitution-compliant date-stamped filenames in src/ts/main.ts and src/ts/export.ts
- [ ] T023 [US1] Update `src/ts/ui.ts`: add loading spinner shown during API calls and hidden on response; add error banner displayed when API calls throw ApiError; remove any remaining localStorage-specific entry storage calls in src/ts/ui.ts

**Checkpoint**: All T016 integration tests pass. App loads entries from the API. Entries persist across browser sessions. Error banner appears when the backend is unreachable.

---

## Phase 4: User Story 2 — Chart Renders from Server-Computed Data (Priority: P2)

**Goal**: All chart calculation logic (trendline, floor, ceiling, ideal) is ported from TypeScript to `ChartCalculationService` on the server; the frontend receives a pre-computed `ChartDataSet` and renders it directly with no local calculation.

**Independent Test**: Seed 10+ entries spanning ≥7 distinct calendar days with a weight goal configured. `GET /api/chart` must return `"corridorState": "ready"` with non-null `trendline`, `floor`, `ceiling`, and `ideal` arrays expressed in the configured unit.

> **TDD**: Write T024–T026 first and confirm all tests FAIL before implementing T027–T031.

### Tests — write first, must FAIL before implementation

- [ ] T024 [US2] Write failing unit tests for `ChartCalculationService` as xUnit [Theory] tests porting the existing TypeScript test cases: four corridorState transitions (no-data, no-goal, calibrating, ready), unit conversion (kg→lbs: × 2.20462; lbs→kg: × 0.453592), daily averaging (multiple entries same day → mean), gap interpolation between non-consecutive measured days, corridor line computation (trendline slope, floor/ceiling offsets, ideal target line) in backend/WeightTracker.Tests/Unit/Services/ChartCalculationServiceTests.cs
- [ ] T025 [P] [US2] Write failing unit tests for `ChartCalculationService` edge cases: single entry only, all entries on one calendar day, weight goal exactly equals current average weight, 100+ entries spanning many months in backend/WeightTracker.Tests/Unit/Services/ChartCalculationServiceEdgeCaseTests.cs
- [ ] T026 [P] [US2] Write failing integration tests for `GET /api/chart` covering all four corridorState response shapes matching contracts/api.md exactly, verifying null vs non-null corridor arrays per state, and confirming unit conversion when PreferredUnit differs from stored entry Unit in backend/WeightTracker.Tests/Integration/Endpoints/ChartEndpointsTests.cs

### Implementation

- [ ] T027 [US2] Implement `ChartCalculationService` as a direct port of `src/ts/chart-calculations.ts`: load all entries and settings for the current user from injected repositories, apply unit conversion, compute daily averages, interpolate gaps, evaluate the corridorState decision tree per data-model.md (no-data / no-goal / calibrating / ready), compute trendline/floor/ceiling/ideal only when corridorState = "ready", return a ChartDataSet in backend/WeightTracker.Infrastructure/Services/ChartCalculationService.cs
- [ ] T028 [P] [US2] Implement `ChartEndpoints` extension method `MapChartEndpoints()` registering `GET /api/chart`; handler reads CurrentUserId from HttpContext.Items, calls IChartCalculationService.ComputeChartDataAsync(), returns ChartDataSet serialised as JSON per contracts/api.md in backend/WeightTracker.Api/Endpoints/ChartEndpoints.cs
- [ ] T029 [US2] Register IChartCalculationService/ChartCalculationService in DI and call app.MapChartEndpoints() in backend/WeightTracker.Api/Program.cs
- [ ] T030 [P] [US2] Add getChartData(): Promise<ChartDataSet> typed fetch wrapper to src/ts/api-client.ts
- [ ] T031 [US2] Update `src/ts/chart.ts`: remove the local computeChartData() call; call getChartData() from api-client and pass the pre-computed DataPoints, Trendline, Floor, Ceiling, and Ideal arrays directly to Chart.js dataset configuration; use corridorState to show or hide the informational message in src/ts/chart.ts

**Checkpoint**: All T024–T026 tests pass. Chart renders from server-computed data. Corridor lines appear only after ≥7 distinct calendar days with a weight goal set.

---

## Phase 5: User Story 3 — Chart Settings Persist on the Server (Priority: P3)

**Goal**: ChartSettings (weight goal, loss rate, carb/fat ratio, buffer value, preferred unit) are stored in the database and automatically restored on every page load; `preferences.ts` is deleted.

**Independent Test**: Configure all chart settings and the preferred unit via the settings modal. Close the browser completely. Reopen the app in a fresh session; the settings modal pre-populates with the saved values and the unit selector matches the saved unit.

> **TDD**: Write T032 first and confirm all tests FAIL before implementing T033–T038.

### Tests — write first, must FAIL before implementation

- [ ] T032 [US3] Write failing integration tests for `GET /api/settings` (returns seeded defaults on fresh DB; returns updated values after a preceding PUT) and `PUT /api/settings` (200 with updated settings on valid input; 400 with field for each invalid case: negative lossRate, negative carbFatRatio, negative bufferValue, invalid preferredUnit, negative non-null weightGoal; null weightGoal accepted) in backend/WeightTracker.Tests/Integration/Endpoints/SettingsEndpointsTests.cs

### Implementation

- [ ] T033 [P] [US3] Implement `ChartSettingsRepository`: GetByUserAsync(Guid userId) returns the single settings record for the user; UpsertAsync(ChartSettings settings) updates all fields and sets UpdatedAt = DateTime.UtcNow on the existing record (never inserts — the seeder guarantees a row always exists) in backend/WeightTracker.Infrastructure/Repositories/ChartSettingsRepository.cs
- [ ] T034 [P] [US3] Implement `SettingsEndpoints` extension method `MapSettingsEndpoints()` with `GET /api/settings` (returns current settings as JSON per contracts/api.md) and `PUT /api/settings` (validates all fields per data-model.md validation rules, calls UpsertAsync, returns updated settings); both handlers read CurrentUserId from HttpContext.Items in backend/WeightTracker.Api/Endpoints/SettingsEndpoints.cs
- [ ] T035 [US3] Register IChartSettingsRepository/ChartSettingsRepository in DI and call app.MapSettingsEndpoints() in backend/WeightTracker.Api/Program.cs
- [ ] T036 [P] [US3] Add getSettings(): Promise<ChartSettings> and updateSettings(settings: ChartSettingsPayload): Promise<ChartSettings> typed fetch wrappers to src/ts/api-client.ts
- [ ] T037 [US3] Update `src/ts/main.ts`: call getSettings() on startup to initialise the unit selector and pre-populate the settings modal fields; wire settings modal save → updateSettings() followed by chart refresh via getChartData() and history refresh via getEntries() in src/ts/main.ts
- [ ] T038 [US3] Delete `src/ts/preferences.ts` and remove all import references to it throughout the codebase; unit preference is now sourced exclusively from the ChartSettings API response in src/ts/preferences.ts (deleted) and all referencing files

**Checkpoint**: All T032 tests pass. Settings survive browser close and full reopen. Changing the unit preference updates both chart and history within one server round-trip with no stale values.

---

## Phase 6: User Story 4 — One-Time Data Migration from Browser Storage (Priority: P4)

**Goal**: Existing users with weight history in localStorage can import it into the database via an in-app button; the tool runs once, reports migrated and skipped counts, and disappears after success.

**Independent Test**: Open browser DevTools and populate localStorage with 5 entries and a settings object. Click "Import from previous version". Verify all 5 entries appear in the history list, settings modal reflects migrated values, and the button is no longer visible. Re-trigger migration — no duplicates are created.

> **TDD**: Write T039 first and confirm all tests FAIL before implementing T040–T043.

### Tests — write first, must FAIL before implementation

- [ ] T039 [US4] Write failing integration tests for `POST /api/migrate`: happy path (5 valid entries + settings → { migratedEntries: 5, skippedEntries: 0, settingsMigrated: true }), partial failure (2 valid + 1 invalid weight value → { migratedEntries: 2, skippedEntries: 1, skippedReasons: [...] }), idempotency (re-submit same 5-entry payload → { migratedEntries: 0, skippedEntries: 5 }), empty entries with no settings ({ migratedEntries: 0, skippedEntries: 0, settingsMigrated: false }), 400 on missing entries field in backend/WeightTracker.Tests/Integration/Endpoints/MigrationEndpointsTests.cs

### Implementation

- [ ] T040 [US4] Implement `MigrationEndpoints` extension method `MapMigrationEndpoints()` with `POST /api/migrate`; iterate the entries array — validate each entry (same rules as POST /api/entries), skip invalid ones recording a human-readable reason, use WeightEntryRepository.AddAsync() insert-or-skip semantics for duplicates, count migrated vs skipped; if settings is present and valid call ChartSettingsRepository.UpsertAsync(); always return 200 with { migratedEntries, skippedEntries, settingsMigrated, skippedReasons } unless body is malformed JSON (then 400) in backend/WeightTracker.Api/Endpoints/MigrationEndpoints.cs
- [ ] T041 [US4] Register MigrationEndpoints and call app.MapMigrationEndpoints() in backend/WeightTracker.Api/Program.cs
- [ ] T042 [US4] Implement `src/ts/migration-tool.ts`: read weight_tracker_entries and weight_tracker_preferences from localStorage, map to the POST /api/migrate request body shape (entries array + optional settings object), POST via fetch(getApiUrl() + '/api/migrate'), return the parsed MigrationResult response in src/ts/migration-tool.ts
- [ ] T043 [US4] Update `src/ts/ui.ts`: on page load check whether localStorage.getItem('weight_tracker_entries') returns a non-empty value; if so render an "Import from previous version" button; on button click call migration-tool, display result message ("Migrated N entries. Skipped M." plus any skip reasons), re-render entries and chart from API, hide button after successful response in src/ts/ui.ts

**Checkpoint**: All T039 tests pass. Existing users can migrate localStorage data once. Re-running migration creates no duplicates. The import button disappears after success.

---

## Phase 7: User Story 5 — Deployable via Docker Compose (Priority: P5)

**Goal**: `docker-compose up` starts all three containers in health-check-enforced order (database → backend → frontend); the frontend API URL is runtime-injectable via environment variable; data survives container restarts.

**Independent Test**: Run `docker-compose up` on a clean machine. Navigate to `http://localhost:3000`. Log a weight entry. Run `docker-compose restart db`. Reload the browser — the entry is still present.

### Implementation

- [ ] T044 [P] [US5] Create `public/config.json.template` containing exactly `{ "apiUrl": "${API_URL}" }` at the repository root public/ directory
- [ ] T045 [P] [US5] Create `entrypoint.sh` at the repository root: run `envsubst '$API_URL' < /usr/share/nginx/html/config.json.template > /usr/share/nginx/html/config.json` then `exec nginx -g 'daemon off;'`; make the file executable in entrypoint.sh
- [ ] T046 [P] [US5] Update the frontend `Dockerfile`: install gettext (provides envsubst) in the nginx stage, copy public/config.json.template and entrypoint.sh into the image, add an nginx `location /config.json { add_header Cache-Control "no-cache"; }` block to prevent stale config caching, set `ENTRYPOINT ["/entrypoint.sh"]` in Dockerfile
- [ ] T047 [US5] Create `backend/WeightTracker.Api/Dockerfile`: two-stage build — stage 1 uses `mcr.microsoft.com/dotnet/sdk:8.0-alpine` to dotnet restore and dotnet publish -c Release -o /app; stage 2 uses `mcr.microsoft.com/dotnet/aspnet:8.0-alpine`, copies /app from stage 1, sets EXPOSE 8080 and `ENTRYPOINT ["dotnet", "WeightTracker.Api.dll"]` in backend/WeightTracker.Api/Dockerfile
- [ ] T048 [US5] Create `docker-compose.yml` at the repository root with three services: db (postgres:16-alpine, named volume weighttracker-data at /var/lib/postgresql/data, POSTGRES_* env vars, pg_isready healthcheck); backend (built from backend/WeightTracker.Api/Dockerfile, ALLOWED_ORIGIN and ConnectionStrings__DefaultConnection env vars, depends_on db condition: service_healthy, /health endpoint healthcheck); frontend (built from repo root Dockerfile, API_URL env var, port 3000:80, depends_on backend condition: service_healthy) in docker-compose.yml
- [ ] T049 [US5] Verify end-to-end per quickstart.md: create .env file, run docker-compose up, confirm all containers reach healthy via docker-compose ps, curl http://localhost:8080/health returns Healthy, log a weight entry in the browser, run docker-compose restart db, verify the entry persists in a fresh browser load, run docker-compose down to clean up

**Checkpoint**: Full stack starts with `docker-compose up`. API URL is runtime-configurable without image rebuild. Data survives any single container restart.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Frontend test updates, documentation, and final validation across all user stories.

- [ ] T050 [P] Update frontend tests in `tests/` to mock the api-client module (using vi.mock) instead of the localStorage storage module; remove or rewrite any tests that assert directly on localStorage key values; ensure tests covering entry rendering, chart display, and settings modal still pass in tests/
- [ ] T051 [P] Update `CLAUDE.md` with new technology entries for 003-backend-api-migration: C# 12 / .NET 8 ASP.NET Core minimal API, EF Core 8 + Npgsql, xUnit + WebApplicationFactory + Testcontainers, docker-compose, entrypoint.sh + envsubst pattern in CLAUDE.md
- [ ] T052 Run the full validation suite: `npm test && npm run lint` from repo root; `cd backend && dotnet test` (all xUnit tests pass); follow all quickstart.md verification steps end-to-end; confirm docker-compose up succeeds and GET /health returns Healthy

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — first story to implement; 🎯 MVP
- **US2 (Phase 4)**: Depends on Phase 2; entry data in DB is needed for meaningful chart tests (US1 provides the entry endpoint used to seed integration tests)
- **US3 (Phase 5)**: Depends on Phase 2; can proceed concurrently with US1 and US2 backend work if staffed
- **US4 (Phase 6)**: Depends on Phase 2 + US1 (entry insert reused by migration) + US3 (settings upsert reused by migration)
- **US5 (Phase 7)**: Depends on all previous phases — packages and deploys the full system
- **Polish (Phase 8)**: Depends on US1–US5

### User Story Dependencies

| Story | Hard Dependencies | Can Parallelize With |
|-------|-------------------|---------------------|
| US1 (P1) | Phase 2 | US2 backend, US3 backend |
| US2 (P2) | Phase 2, US1 (entry endpoint for test seeding) | US1 frontend, US3 backend |
| US3 (P3) | Phase 2 | US1, US2 backend |
| US4 (P4) | Phase 2, US1, US3 | — |
| US5 (P5) | All phases | — |

### Within Each User Story

1. Test file(s) MUST be written first and **confirmed FAILING** before any implementation begins
2. Repository → Endpoint → Program.cs registration (sequential within backend stack)
3. Repository and endpoint tasks marked `[P]` in the same story can be written simultaneously (different files)
4. Frontend api-client.ts additions can be written in parallel with backend implementation (different stack, different file)
5. Frontend main.ts / ui.ts updates depend on api-client.ts additions being complete

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel after T001
- **Phase 2**: T004, T005, T006, T007 can all run in parallel after T001; T010, T011, T012 can run in parallel after T008 + T009; T013 can run after T007
- **US1**: T017 and T018 can run in parallel after T016; T020 and T021 can run in parallel with T017/T018 (different stack)
- **US2**: T024, T025, T026 can all be written in parallel; T027 and T028 can be implemented in parallel after tests; T030 can be added in parallel with backend tasks
- **US3**: T033 and T034 can run in parallel after T032; T036 can be added in parallel with T033/T034
- **US5**: T044, T045, T046 can all run in parallel

---

## Parallel Execution Examples

### Phase 3: US1 Backend + Frontend in Parallel

```
# Step 1: Write and confirm tests fail
Task: T016 — EntryEndpointsTests

# Step 2: Implement in parallel after T016 confirmed failing:
Backend A: T017 — WeightEntryRepository
Backend B: T018 — EntryEndpoints
Frontend C: T020 — config.ts
Frontend D: T021 — api-client.ts entry wrappers

# Step 3: Wire and integrate (sequential):
T019 — Register in Program.cs (after T017 + T018)
T022 — Rewrite main.ts (after T020 + T021 + T019)
T023 — Update ui.ts (after T022)
```

### Phase 4: US2 All Tests + Frontend in Parallel

```
# Step 1: Write all three test files in parallel:
Task A: T024 — ChartCalculationServiceTests
Task B: T025 — ChartCalculationServiceEdgeCaseTests
Task C: T026 — ChartEndpointsTests

# Step 2: Implement in parallel after all tests confirmed failing:
Backend A: T027 — ChartCalculationService
Backend B: T028 — ChartEndpoints
Frontend C: T030 — api-client.ts getChartData()

# Step 3: Wire and integrate:
T029 — Register in Program.cs (after T027 + T028)
T031 — Update chart.ts (after T030 + T029)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: User Story 1 (T016–T023)
4. **STOP and VALIDATE**: Log entries in Browser A; verify they appear in fresh Browser B session
5. Demo / ship as MVP if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → backend starts; `GET /health` returns `Healthy`
2. Phase 3 (US1) → entries CRUD via API; cross-session persistence ✅
3. Phase 4 (US2) → chart renders from server-computed data; corridor lines from backend ✅
4. Phase 5 (US3) → settings persist on server; unit preference survives sessions ✅
5. Phase 6 (US4) → existing users can import localStorage data once ✅
6. Phase 7 (US5) → full `docker-compose up` deployment; runtime URL injection ✅
7. Phase 8 → frontend tests updated; docs complete; full validation ✅

---

## Notes

- `[P]` tasks touch different files and have no unresolved intra-phase dependencies
- Each user story has an **Independent Test** — verify it manually at each phase checkpoint
- TDD is mandatory: confirm test **FAILURE** before writing any implementation code
- Commit after each logical task group or phase checkpoint
- For backend-only development: `docker-compose up db` starts PostgreSQL without the full stack
- For frontend-only development: manually create `public/config.json` with `{ "apiUrl": "http://localhost:8080" }` per quickstart.md
- `StubCurrentUserResolver` is the only component replaced when spec 004 adds real JWT auth — no route handlers, repositories, or schema changes required
- All WeightEntry values are stored in the unit they were entered in; ChartCalculationService converts to PreferredUnit at query time
