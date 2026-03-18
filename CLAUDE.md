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
- TypeScript 5.x (frontend), C# 12 / .NET 8 (backend — unchanged) + Vite 5.x, Vitest 2.x, nginx:alpine, Docker Compose v2 (file moves only — no new dependencies) (004-repo-restructure-docs)
- PostgreSQL 16 via Docker named volume `weighttracker-data` (unchanged) (004-repo-restructure-docs)
- C# 12 / .NET 8 (backend); TypeScript 5.x / ES2020 (frontend) (006-jwt-auth-setup)
- PostgreSQL 16 — adds `RefreshTokens` table; alters `Users` table (006-jwt-auth-setup)
- C# 12 / .NET 8 (backend); TypeScript 5.x / ES2020 (frontend — api-client.ts only) + ASP.NET Core Minimal API, EF Core 8, Npgsql, BCrypt.Net-Next, MailKit 4.x (new), Testcontainers 3.10.0 + MailHog generic container (new) (007-admin-user-management)
- PostgreSQL 16 — adds `PasswordResetTokens`, `EmailConfirmationTokens`, `AuditLog` tables; alters `Users` table (007-admin-user-management)
- TypeScript 5.x (browser ES2020) for all frontend work; C# 12 / .NET 8 for the one backend amendmen + Vite 5.x (build + dev server); Vitest 2.x + jsdom (frontend tests); existing `api-client.ts`, `auth-guard.ts`, `auth-token.ts`; xUnit + Testcontainers.PostgreSql (backend amendment test) (008-frontend-admin-ui)
- No new storage — no `localStorage` usage, no new database columns (008-frontend-admin-ui)
- TypeScript 5.x (browser target ES2020); HTML5; CSS3 + Tailwind CSS v3 (PostCSS plugin), DaisyUI v4 (Tailwind plugin), Vite 5.x (existing) (009-tailwind-daisyui-redesign)
- None — no localStorage, no new DB columns (009-tailwind-daisyui-redesign)
- YAML (Docker Compose v2), nginx config syntax, shell (env var substitution) + Docker Compose v2, Traefik v2.x (labels compatible with v3.x), nginx:alpine (existing) (010-production-hardening)
- N/A — no database schema changes (010-production-hardening)
- C# 12 / .NET 8 (backend); TypeScript 5.x / ES2020 (frontend) + ASP.NET Core Minimal API, EF Core 8 + Npgsql; Vite 5.x, Tailwind CSS v3, DaisyUI v4 (frontend — no new packages needed) (011-data-import)
- PostgreSQL 16 — no schema changes; new repository method only (011-data-import)
- Markdown (CommonMark + GitHub Flavored Markdown); MermaidJS for diagrams + None — documentation only; MermaidJS renders natively on GitHub (012-docs-overhaul)
- TypeScript 5.x (browser target ES2020) + Vite 5.x (build), Vitest 2.x + jsdom (tests), Tailwind CSS v3 + DaisyUI v4 (UI), existing `api-client.ts`, `auth-guard.ts`, `config.ts`, `theme.ts` (013-confirm-email-page)
- C# 12 / .NET 8 (backend); TypeScript 5.x ES2020 (frontend) + ASP.NET Core Minimal API, EF Core 8 + Npgsql (backend); Vite 5.x, Vitest 2.x + jsdom (frontend) (014-confirm-email-password-setup)
- PostgreSQL 16 — no schema changes; `PasswordResetTokens` table is written to via existing infrastructure (014-confirm-email-password-setup)

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
cd frontend && npm test && npm run lint

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
- 014-confirm-email-password-setup: Added C# 12 / .NET 8 (backend); TypeScript 5.x ES2020 (frontend) + ASP.NET Core Minimal API, EF Core 8 + Npgsql (backend); Vite 5.x, Vitest 2.x + jsdom (frontend)
- 013-confirm-email-page: Added TypeScript 5.x (browser target ES2020) + Vite 5.x (build), Vitest 2.x + jsdom (tests), Tailwind CSS v3 + DaisyUI v4 (UI), existing `api-client.ts`, `auth-guard.ts`, `config.ts`, `theme.ts`
- 012-docs-overhaul: Added Markdown (CommonMark + GitHub Flavored Markdown); MermaidJS for diagrams + None — documentation only; MermaidJS renders natively on GitHub


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
