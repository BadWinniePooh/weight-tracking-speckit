# Quickstart: Tailwind CSS + DaisyUI UI Redesign

**Feature**: 009-tailwind-daisyui-redesign
**Branch**: `009-tailwind-daisyui-redesign`

---

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for full-stack testing)
- The frontend already builds with `npm run build` and tests pass with `npm test`

---

## Step 1: Install New Dependencies

```bash
cd frontend
npm install -D tailwindcss@3 postcss autoprefixer daisyui@4
```

Verify the additions in `package.json` devDependencies:
- `"tailwindcss": "^3.x.x"`
- `"postcss": "^8.x.x"`
- `"autoprefixer": "^10.x.x"`
- `"daisyui": "^4.x.x"`

---

## Step 2: Create Tailwind Configuration

Create `frontend/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,ts}",
    "./tests/**/*.ts",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light --default", "dark --prefersdark"],
    // 'light' is default; 'dark' activates via @media (prefers-color-scheme: dark)
    logs: false,
  },
};
```

---

## Step 3: Create PostCSS Configuration

Create `frontend/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## Step 4: Update CSS Entry Point

Replace `frontend/src/css/main.css` contents:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom overrides for health/fitness theme palette */
[data-theme="light"],
:root {
  --p: 160 84% 39%;   /* primary: emerald-600 */
  --pc: 0 0% 100%;    /* primary-content: white */
  --a: 38 92% 50%;    /* accent: amber-500 */
  /* ... additional token overrides per design-system.md */
}

[data-theme="dark"] {
  --p: 160 84% 60%;   /* primary: emerald-400 */
  --pc: 220 9% 10%;   /* primary-content: near-black */
  --a: 38 92% 65%;    /* accent: amber-400 */
  /* ... additional token overrides per design-system.md */
}

/* Chart container height — no DaisyUI equivalent */
#chart-container {
  position: relative;
  height: 260px;
  width: 100%;
}

@media (min-width: 768px) {
  #chart-container {
    height: 320px;
  }
}
```

---

## Step 5: Verify Build

```bash
cd frontend
npm run build
```

Expected: build succeeds; `dist/` contains CSS with Tailwind utilities.

---

## Step 6: Run Tests

```bash
cd frontend
npm test
```

All tests must pass before any HTML restyling begins.

---

## Step 7: Development Server

```bash
cd frontend
npm run dev
```

Navigate to `http://localhost:5173` to see live-reload of style changes.

---

## Step 8: Full-Stack Verification (Docker)

```bash
# From repo root
docker compose up --build
```

Then open `http://localhost:8080` to verify the redesigned app against the live backend.

---

## Testing Dark Mode Locally

**Chrome DevTools**: Open DevTools → Rendering tab (under more tools) → check "Emulate CSS media feature prefers-color-scheme" → select `dark`.

**macOS**: System Preferences → Appearance → Dark.

---

## Design System Reference

See `docs/design-system.md` for the complete color palette, typography decisions, component
guidelines, and rationale for all major design choices.
