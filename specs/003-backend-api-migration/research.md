# Research: Backend API Migration (003)

**Date**: 2026-03-14
**Purpose**: Resolve all NEEDS CLARIFICATION items from Technical Context before Phase 1 design.

---

## Decision 1: Frontend Runtime Environment Variable Injection

**Context**: Vite bakes environment variables at build time. FR-013 requires the API base URL to be injectable at Docker container startup — no image rebuild.

**Decision**: Use a `public/config.json.template` file containing `{ "apiUrl": "${API_URL}" }`. A shell entrypoint script (`entrypoint.sh`) runs `envsubst` at container startup to produce the live `public/config.json`. The TypeScript frontend fetches `/config.json` once on startup before any DOM initialisation.

**Implementation touch-points**:
- `public/config.json.template` — build artefact with placeholder; copied into Docker image
- `entrypoint.sh` — runs `envsubst`, then starts nginx
- `Dockerfile` — adds `gettext` (provides `envsubst`), sets `ENTRYPOINT ["/entrypoint.sh"]`
- New `src/ts/config.ts` — exports `loadConfig(): Promise<void>` and `getApiUrl(): string`
- `src/ts/main.ts` — calls `await loadConfig()` as first async action before DOM setup
- `nginx.conf` — adds `Cache-Control: no-cache` for `/config.json` so stale config is never served

**Rationale**: The `config.json` pattern is the industry standard for runtime config injection in Vite + nginx Docker deployments. It is straightforward to debug (inspect `/config.json` in browser DevTools), requires no changes to the Vite build pipeline, and cleanly supports multiple config values.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|-----------------|
| `window.__config__` via `envsubst` on `index.html` | Requires maintaining an `index.html.template` alongside the real file; harder to inspect; Vite's HMR rewrites index.html during dev |
| Build-time `VITE_API_URL` | Fails FR-013 — image must be rebuilt per environment |
| nginx `sub_filter` | Complex, brittle, requires nginx recompile for the module on Alpine |

---

## Decision 2: ASP.NET Core API Style

**Decision**: Minimal API — `Program.cs`-centric endpoint registration with feature-scoped extension methods (`MapEntryEndpoints()`, `MapSettingsEndpoints()`, etc.) on `IEndpointRouteBuilder`.

**Rationale**: The API surface is small (9 endpoints across 4 resource areas). Minimal API eliminates controller boilerplate and keeps `Program.cs` the single authoritative wiring point. Endpoint grouping via extension methods provides the same organisational clarity as controllers without the overhead.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|-----------------|
| MVC Controllers | Better for large APIs with versioning, complex attribute routing; overhead unjustified here |
| gRPC | Not a browser-native REST API; requires gRPC-Web proxy for browser clients |

---

## Decision 3: .NET 8 Docker Base Images

**Decision**: Multi-stage build — `mcr.microsoft.com/dotnet/sdk:8.0-alpine` (build stage) → `mcr.microsoft.com/dotnet/aspnet:8.0-alpine` (runtime stage).

**Rationale**: Alpine runtime images are ~50 MB vs ~200 MB for the Debian-based alternative. No Windows-specific dependencies are used. Pinning to the major/minor (`8.0`) without a patch tag allows automated security patching while keeping a stable base.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|-----------------|
| `8.0` Debian-based | 4× larger image; no benefit for this workload |
| `8.0-jammy` Ubuntu Chiseled | Smaller but less battle-tested in CI toolchains; acceptable future option |

---

## Decision 4: EF Core Migration Strategy

**Decision**: Auto-run `await context.Database.MigrateAsync()` in `Program.cs` on startup, wrapped in a retry loop (30 attempts × 1-second delay). Database seeding (default user + default chart settings) runs immediately after a successful migration.

**Rationale**: For a single-instance deployment, auto-migration on startup is the simplest path to SC-005 (single `docker-compose up`). The retry loop handles the race between the ASP.NET Core container's process start and PostgreSQL completing its own initialisation sequence — even with docker-compose `service_healthy` ordering, there is a window between `pg_isready` returning true and PostgreSQL accepting user connections.

**Concurrent migration risk**: Not applicable in this deployment (single backend container). Noted for spec 004+ if horizontal scaling is introduced.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|-----------------|
| EF Core Migration Bundle (separate CLI) | Adds a CI/CD step; contradicts single-command startup goal |
| Flyway / Liquibase | Additional dependency; EF Core already owns the schema definition |
| Manual SQL (DBA applies migrations) | Contradicts SC-005 |

---

## Decision 5: User-Resolution Middleware Pattern

**Decision**: Define `ICurrentUserResolver` in `WeightTracker.Domain`. Register `StubCurrentUserResolver` (always returns the seeded default user's ID) via DI. A `CurrentUserMiddleware` calls the resolver and writes the result to `HttpContext.Items["CurrentUserId"]` before endpoint handlers execute.

**Rationale**: Satisfies FR-024 and FR-025 exactly. Spec 004 upgrade path requires only replacing one DI registration: `services.AddScoped<ICurrentUserResolver, StubCurrentUserResolver>()` → `services.AddScoped<ICurrentUserResolver, JwtCurrentUserResolver>()`. No endpoint handlers or repository methods change.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|-----------------|
| Hardcoded user ID inline in each endpoint handler | Couples every handler to user resolution; impossible to swap without editing all routes |
| `HttpContext.User` claims directly | Correct long-term approach (spec 004 will use it); the stub middleware can write claims to `HttpContext.User` instead of `Items` as a forward-compatible variant — deferred to spec 004 to keep the stub minimal |

---

## Decision 6: Backend Test Strategy

**Decision**: xUnit for all backend tests. Unit tests for `ChartCalculationService` (pure domain logic — port of the existing TypeScript chart-calculations tests as xUnit `[Theory]` tests). Integration tests for API endpoints using `WebApplicationFactory<Program>` with a real PostgreSQL instance (Testcontainers.NET or a dedicated `docker-compose.test.yml`).

**Rationale**: `WebApplicationFactory` exercises the full ASP.NET Core pipeline (middleware, DI, EF Core) without mocking, catching integration bugs that unit tests miss. The chart calculation service has complex, fully specified behaviour (existing TypeScript tests serve as the specification) that maps directly to parameterised theory tests.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|-----------------|
| In-memory SQLite for integration tests | EF Core behaviour diverges from PostgreSQL on decimal precision, case sensitivity, and array types |
| Mocking repositories in endpoint integration tests | Defeats the purpose; acceptance scenarios require end-to-end data flow through EF Core |
