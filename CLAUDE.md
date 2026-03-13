# weight-tracking Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-13

## Active Technologies
- TypeScript 5.x (browser target: ES2020) + Chart.js ^4.0.0, chartjs-adapter-date-fns ^3.0.0, date-fns ^3.0.0 (new); Vite 5.x (existing) (002-chart-visualization)
- Browser `localStorage` (keys: `weight_tracker_chart_settings`, `weight_tracker_entries`, `weight_tracker_preferences`) (002-chart-visualization)

- TypeScript 5.x (browser target: ES2020); HTML5; CSS3 + Vite 5.x (build + dev server); Vitest 2.x + jsdom (testing) (001-weight-tracker-app)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (browser target: ES2020); HTML5; CSS3: Follow standard conventions

## Recent Changes
- 002-chart-visualization: Added TypeScript 5.x (browser target: ES2020) + Chart.js ^4.0.0, chartjs-adapter-date-fns ^3.0.0, date-fns ^3.0.0 (new); Vite 5.x (existing)

- 001-weight-tracker-app: Added TypeScript 5.x (browser target: ES2020); HTML5; CSS3 + Vite 5.x (build + dev server); Vitest 2.x + jsdom (testing)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
