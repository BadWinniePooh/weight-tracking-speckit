# weight-tracking Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-14

## Active Technologies
- C# 12 / .NET 8 ASP.NET Core Minimal API — Ports and Adapters architecture (Domain / Infrastructure / Api / Tests) (003-backend-api-migration)
- EF Core 8 + Npgsql (Npgsql.EntityFrameworkCore.PostgreSQL) — PostgreSQL 16 via Docker named volume `weighttracker-data` (003-backend-api-migration)
- xUnit + WebApplicationFactory<Program> + Testcontainers.PostgreSql — all backend tests in WeightTracker.Tests (003-backend-api-migration)
- Docker Compose — 3 services: db (postgres:16-alpine), backend (.NET), frontend (nginx+envsubst); health-check-ordered startup (003-backend-api-migration)
- Runtime API URL injection via `envsubst` + `public/config.json.template` → `/config.json` in nginx container (003-backend-api-migration)
- TypeScript 5.x (browser target: ES2020) + Chart.js ^4.0.0, chartjs-adapter-date-fns ^3.0.0, date-fns ^3.0.0 (new); Vite 5.x (existing) (002-chart-visualization)
- PostgreSQL 16 in a Docker container with a named persistent volume (003-backend-api-migration)

- TypeScript 5.x (browser target: ES2020); HTML5; CSS3 + Vite 5.x (build + dev server); Vitest 2.x + jsdom (testing) (001-weight-tracker-app)

## Project Structure

```text
backend/
  WeightTracker.Domain/        # Entities, interfaces — zero external deps
  WeightTracker.Infrastructure/ # EF Core, repositories, services, seeding
  WeightTracker.Api/           # ASP.NET Core Minimal API endpoints
  WeightTracker.Tests/         # All xUnit tests (Unit/ + Integration/)
src/ts/                        # Frontend TypeScript
tests/                         # Frontend Vitest tests
docker-compose.yml             # Full stack: db + backend + frontend
```

## Commands

# Frontend
npm test && npm run lint

# Backend (from backend/ directory)
cd backend && dotnet test

## Backend Testing Rules (003-backend-api-migration)
- TDD mandatory: failing test in WeightTracker.Tests first, then implementation
- All test files MUST live in WeightTracker.Tests — never in Domain/Infrastructure/Api
- Test file naming mirrors project structure: Infrastructure/Repositories/FooRepository.cs → Tests/Integration/Repositories/FooRepositoryTests.cs
- Integration tests use Testcontainers.PostgreSql (real PostgreSQL, no mocks)

## Code Style

TypeScript 5.x (browser target: ES2020); HTML5; CSS3: Follow standard conventions
C# 12 / .NET 8: Follow standard C# conventions; primary constructors preferred

## Recent Changes
- 003-backend-api-migration: Full backend API with PostgreSQL; Docker Compose deployment; chart calculation service; data migration endpoint; TDD throughout
- 002-chart-visualization: Added TypeScript 5.x (browser target: ES2020) + Chart.js ^4.0.0, chartjs-adapter-date-fns ^3.0.0, date-fns ^3.0.0 (new); Vite 5.x (existing)

- 001-weight-tracker-app: Added TypeScript 5.x (browser target: ES2020); HTML5; CSS3 + Vite 5.x (build + dev server); Vitest 2.x + jsdom (testing)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
