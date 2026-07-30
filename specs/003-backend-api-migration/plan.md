# Implementation Plan: Backend API Migration

**Branch**: `003-backend-api-migration` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-backend-api-migration/spec.md`

## Summary

Migrate all data persistence and domain logic from browser `localStorage` and front-end TypeScript to a self-hosted backend. Introduce a C# ASP.NET Core minimal API backed by PostgreSQL with a repository-pattern data layer and a multi-tenancy-ready schema (user_id FKs, seeded default user, replaceable stub user-resolver middleware). All chart-calculation logic moves from the frontend to a server-side `ChartCalculationService`. The frontend becomes a thin client: it fetches a runtime `config.json` for the API URL, calls the API for all reads and writes, and renders pre-computed chart data. A one-time in-app migration tool transfers existing localStorage data to the server. The full stack deploys with `docker-compose up`.

---

## Technical Context

**Language / Version (Frontend)**: TypeScript 5.x — existing stack; no new dependencies
**Language / Version (Backend)**: C# 12 / .NET 8 — ASP.NET Core minimal API
**Primary Dependencies (Frontend)**: Vite 5.x, Chart.js ^4.0, date-fns ^3.0 (all existing; no additions)
**Primary Dependencies (Backend)**: EF Core 8 + Npgsql (PostgreSQL provider), ASP.NET Core built-in Health Checks; xUnit (tests)
**Storage**: PostgreSQL 16 in a Docker container with a named persistent volume
**Testing (Frontend)**: Vitest 2.x + jsdom (existing)
**Testing (Backend)**: xUnit — unit tests for `ChartCalculationService`; integration tests for endpoints via `WebApplicationFactory<Program>` + real PostgreSQL
**Target Platform**: Docker containers (Linux/Alpine); browser (desktop + mobile)
**Performance Goals**: App loads with data in < 3 seconds on broadband (SC-002)
**Constraints**: No auth this iteration; CORS restricted to configured frontend origin; schema must require zero migrations when auth is added in spec 004
**Scale / Scope**: Single user; single-node self-hosted docker-compose deployment

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | `spec.md` complete with clarification session; no implementation started |
| II. Privacy & Data Ownership | ✅ PASS (with justification) | Data moves from browser localStorage to a **self-hosted** server — this is user-controlled storage. No third-party data transmission. Data export capability (CSV / JSON) preserved from spec 001. HTTPS required at the deployment layer per the constitution. See Complexity Tracking row 1. |
| III. Test-First | ✅ PASS | TDD mandatory: `ChartCalculationService` has fully specified acceptance scenarios (ported from existing TypeScript tests); backend endpoint integration tests written before implementation |
| IV. Incremental Delivery | ✅ PASS | Five user stories ordered P1–P5; P1 (entry CRUD via API) is a standalone usable MVP; each story is independently demonstrable |
| V. Simplicity (YAGNI) | ✅ PASS (with justification) | Repository pattern and multi-tenancy schema are explicitly required by FR-021 and FR-022–026. Three-project backend structure is the minimum needed to honour the interface-separation constraint. See Complexity Tracking rows 2–4. |

*Post-design re-check*: Constitution passes against `data-model.md` and `contracts/api.md`. No new abstractions introduced beyond what the spec explicitly requires.

---

## Project Structure

### Documentation (this feature)

```text
specs/003-backend-api-migration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code

```text
backend/                                    (new)
├── WeightTracker.sln
├── WeightTracker.Domain/                   (entities, interfaces — no EF dependency)
│   ├── Entities/
│   │   ├── User.cs
│   │   ├── WeightEntry.cs
│   │   └── ChartSettings.cs
│   ├── Interfaces/
│   │   ├── Repositories/
│   │   │   ├── IWeightEntryRepository.cs
│   │   │   ├── IChartSettingsRepository.cs
│   │   │   └── IUserRepository.cs
│   │   └── Services/
│   │       ├── IChartCalculationService.cs
│   │       └── ICurrentUserResolver.cs
│   └── Models/
│       ├── ChartDataSet.cs                 (computed response; not stored)
│       └── DailyAverage.cs                 (internal calc intermediate)
├── WeightTracker.Infrastructure/           (EF Core, repositories, services)
│   ├── Data/
│   │   ├── AppDbContext.cs
│   │   └── Migrations/
│   ├── Repositories/
│   │   ├── WeightEntryRepository.cs
│   │   ├── ChartSettingsRepository.cs
│   │   └── UserRepository.cs
│   ├── Services/
│   │   ├── ChartCalculationService.cs      (port of chart-calculations.ts)
│   │   └── StubCurrentUserResolver.cs      (always returns default user ID)
│   └── Seeding/
│       └── DatabaseSeeder.cs               (seeds default user + settings)
├── WeightTracker.Api/                      (minimal API, DI wiring, endpoints)
│   ├── Program.cs
│   ├── appsettings.json
│   ├── Dockerfile
│   └── Endpoints/
│       ├── EntryEndpoints.cs
│       ├── SettingsEndpoints.cs
│       ├── ChartEndpoints.cs
│       ├── MigrationEndpoints.cs
│       └── HealthEndpoints.cs
└── WeightTracker.Tests/
    ├── Unit/
    │   └── Services/
    │       ├── ChartCalculationServiceTests.cs
    │       └── ChartCalculationServiceEdgeCaseTests.cs
    └── Integration/
        ├── Fixtures/
        │   └── ApiFixture.cs               (WebApplicationFactory + test DB)
        └── Endpoints/
            ├── EntryEndpointsTests.cs
            ├── SettingsEndpointsTests.cs
            ├── ChartEndpointsTests.cs
            └── MigrationEndpointsTests.cs

src/                                        (existing frontend — updated in place)
├── index.html                              (updated: add config.js template tag)
└── ts/
    ├── api-client.ts                       (new: typed fetch wrappers for all endpoints)
    ├── config.ts                           (new: loadConfig() / getApiUrl())
    ├── migration-tool.ts                   (new: reads localStorage, posts to /api/migrate)
    ├── main.ts                             (updated: await loadConfig(), use api-client)
    ├── ui.ts                               (updated: remove storage calls, add loading/error)
    ├── chart.ts                            (updated: accept ChartDataSet from server)
    ├── model.ts                            (updated: remove calc-specific types)
    └── preferences.ts                      (removed: unit pref now in ChartSettings via API)

public/
└── config.json.template                    (new: { "apiUrl": "${API_URL}" })

tests/                                      (existing frontend tests — updated)

entrypoint.sh                               (new: envsubst + exec nginx)
Dockerfile                                  (updated: gettext, ENTRYPOINT entrypoint.sh)
docker-compose.yml                          (new)
```

**Structure decision**: Web application layout. Frontend stays at repo root (preserves existing structure, minimises file-move churn). Backend added as `backend/` subdirectory. `docker-compose.yml` at repo root orchestrates all three containers.

### Layer Dependency Rules (Ports and Adapters)

The three backend projects enforce strict unidirectional dependency flow (FR-021, FR-030–032):

```
WeightTracker.Domain        — no outbound dependencies (application core)
        ↑
WeightTracker.Infrastructure — depends on Domain only; never on Api
        ↑
WeightTracker.Api            — depends on Domain + Infrastructure; no business logic
        ↑
WeightTracker.Tests          — depends on all three (test-only)
```

**Enforcement rules**:
- `WeightTracker.Domain.csproj` MUST list zero `<ProjectReference>` entries
- `WeightTracker.Infrastructure.csproj` MUST reference Domain only
- `WeightTracker.Api.csproj` MUST reference Domain and Infrastructure; any business logic found here is a violation
- CI / build verification: `dotnet build` will fail at compile time if any forbidden cross-layer reference is introduced

**What lives where**:

| Layer | Contains | Never contains |
|-------|----------|---------------|
| Domain | Entities, port interfaces (`IWeightEntryRepository`, `IChartSettingsRepository`, `ICurrentUserResolver`, `IChartCalculationService`), domain models (`ChartDataSet`, `DailyAverage`), domain logic | EF Core, Npgsql, ASP.NET Core, HTTP types |
| Infrastructure | EF Core `AppDbContext`, repository implementations, `ChartCalculationService`, `StubCurrentUserResolver`, `DatabaseSeeder`, migrations | ASP.NET Core HTTP pipeline, endpoint definitions |
| Api | `Program.cs`, endpoint extension methods, middleware registration, DI wiring | Business logic, direct DB access, calculation code |

---

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Server-side data storage (vs localStorage) | Core feature requirement; enables cross-session persistence and docker-compose deployment | Keeping localStorage contradicts the entire feature goal (SC-001) |
| Ports and Adapters (Hexagonal Architecture) with strict layer isolation (FR-021, FR-030–032) | Explicit architectural requirement; Domain must be independently testable and infrastructure-agnostic so that EF Core, PostgreSQL, or the stub middleware can each be replaced without touching domain logic | A flat or two-layer structure would co-locate port interfaces with their adapters, making domain-only unit tests dependent on EF assemblies and breaking the swap guarantee |
| Multi-tenancy schema (user_id FK, seeded default user, stub middleware) | FR-022–026 explicitly required; ensures spec 004 adds JWT auth with zero schema migrations or route changes | A single-user schema without user_id would force a breaking `ALTER TABLE` migration when auth is introduced in spec 004 |
| Three-project backend (Domain / Infrastructure / Api) | Minimum structure to physically enforce the Ports and Adapters dependency rules via project references | Two-project or single-project layout cannot enforce the Domain-has-no-deps constraint at compile time |

---

## Implementation Phases

> Phases are consumed by `/speckit.tasks`. Recorded here as a design-time reference.

### Phase 1 — Backend Foundation

1. Create `backend/` solution with Domain, Infrastructure, Api, Tests projects
2. Define domain entities (`User`, `WeightEntry`, `ChartSettings`) and interfaces in `WeightTracker.Domain`
3. Implement `AppDbContext` with EF Core entity configuration and relationships
4. Generate and verify initial EF Core migration (creates Users, WeightEntries, ChartSettings tables with all constraints and indexes)
5. Implement `DatabaseSeeder` (idempotent seed of default user + default chart settings)
6. Wire startup: retry-loop migration, seeding, health checks, CORS, stub middleware in `Program.cs`
7. Verify: `docker-compose up db && dotnet run` → `/health` returns `Healthy`

### Phase 2 — Entry and Settings CRUD (P1 + P3)

Following TDD: tests written first, then implementation.

1. `WeightEntryRepository` — `GetAllAsync`, `AddAsync`, `DeleteAsync`, `DeleteAllAsync`
2. `ChartSettingsRepository` — `GetByUserAsync`, `UpsertAsync`
3. `EntryEndpoints` — `GET /api/entries`, `POST /api/entries`, `DELETE /api/entries/{id}`, `DELETE /api/entries`
4. `SettingsEndpoints` — `GET /api/settings`, `PUT /api/settings`
5. Integration tests for all six endpoints

### Phase 3 — Chart Calculation Service (P2)

1. Port `chart-calculations.ts` logic to `ChartCalculationService.cs` (unit conversion, daily averages, interpolation, corridor lines)
2. Unit tests for `ChartCalculationService` (ported from existing TypeScript test cases)
3. `ChartEndpoints` — `GET /api/chart`
4. Integration tests for chart endpoint (all four `corridorState` variants)

### Phase 4 — Frontend Migration to API Client (P1 + P2 + P3)

1. Add `public/config.json.template`, `entrypoint.sh`; update `Dockerfile`
2. Implement `src/ts/config.ts` and `src/ts/api-client.ts`
3. Rewrite `main.ts`: `await loadConfig()`, replace all localStorage calls with API calls
4. Update `ui.ts`: add loading state, update error handling for API failures
5. Update `chart.ts`: accept `ChartDataSet` from server (remove local `computeChartData` call)
6. Remove `preferences.ts`; unit preference now flows through `ChartSettings` API
7. Update frontend tests to mock `api-client` instead of `storage`

### Phase 5 — Data Migration Tool (P4)

1. Implement `src/ts/migration-tool.ts` (reads localStorage keys, posts to `POST /api/migrate`)
2. Implement `MigrationEndpoints` — `POST /api/migrate` (batch upsert entries, upsert settings)
3. Wire migration tool UI: show button when localStorage data is detected; hide after success
4. Integration tests for migration endpoint (happy path, partial failure, duplicate idempotency)

### Phase 6 — docker-compose and End-to-End Verification (P5)

1. Write `docker-compose.yml` (three services with health-check-based `depends_on`)
2. Write backend `Dockerfile` (multi-stage: sdk:8.0-alpine → aspnet:8.0-alpine)
3. Full end-to-end verification: `docker-compose up` → log entry → restart db container → verify data intact
4. Update `CLAUDE.md` with new technology entries

---

## Key Design Decisions

| Decision | Choice | Reference |
|----------|--------|-----------|
| Frontend env var injection | `config.json` template + `envsubst` at container start | research.md §1 |
| API style | ASP.NET Core minimal API with feature-scoped extension methods | research.md §2 |
| Docker base images | `sdk:8.0-alpine` (build) + `aspnet:8.0-alpine` (runtime) | research.md §3 |
| EF Core migrations | Auto-run on startup with 30-retry loop | research.md §4 |
| User resolution | `ICurrentUserResolver` + `StubCurrentUserResolver` via DI | research.md §5 |
| Backend test strategy | xUnit + `WebApplicationFactory` + real PostgreSQL | research.md §6 |
| Unit preference storage | Part of `ChartSettings` on the server | spec.md Clarifications |
| CORS policy | Restricted to `ALLOWED_ORIGIN` env var; no wildcard | spec.md Clarifications |
| Container startup ordering | Health-check-based `depends_on` in docker-compose | spec.md Clarifications |
