# Data Model: Tailwind CSS + DaisyUI UI Redesign

**Feature**: 009-tailwind-daisyui-redesign
**Date**: 2026-03-16
**Note**: This sprint introduces no new data entities. The "data model" here is the design token
inventory and page/component layout taxonomy that governs the entire redesign.

---

## No New Storage

- No new database tables or columns
- No new `localStorage` keys
- No new API endpoints

---

## Design Token Inventory (CSS Custom Properties)

DaisyUI v4 defines all theme variables on `:root` (or `[data-theme]`). The following tokens are
the primary contract between the design and implementation:

### Color Tokens (DaisyUI semantic names)

| Token | Light value (custom) | Dark value (custom) | Usage |
|-------|---------------------|--------------------|----|
| `--p` (primary) | teal-500 `#10b981` | teal-400 `#34d399` | Primary buttons, active nav |
| `--pc` (primary-content) | white `#ffffff` | gray-900 `#111827` | Text on primary bg |
| `--a` (accent) | amber-500 `#f59e0b` | amber-400 `#fbbf24` | Accent elements, badges |
| `--ac` (accent-content) | gray-900 `#111827` | gray-900 `#111827` | Text on accent bg |
| `--su` (success) | emerald-600 `#059669` | emerald-400 `#34d399` | Active status badge |
| `--er` (error) | red-600 `#dc2626` | red-400 `#f87171` | Error states, deactivated badge |
| `--wa` (warning) | amber-500 `#f59e0b` | amber-400 `#fbbf24` | Warning/pending badge |
| `--b1` (base-100) | white `#ffffff` | gray-900 `#111827` | Page background |
| `--b2` (base-200) | gray-50 `#f9fafb` | gray-800 `#1f2937` | Card backgrounds |
| `--b3` (base-300) | gray-100 `#f3f4f6` | gray-700 `#374151` | Subtle borders |
| `--bc` (base-content) | gray-900 `#111827` | gray-50 `#f9fafb` | Body text |
| `--n` (neutral) | gray-600 `#4b5563` | gray-400 `#9ca3af` | Secondary buttons |
| `--nc` (neutral-content) | white `#ffffff` | gray-900 `#111827` | Text on neutral bg |

### Typography Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Font family | `ui-sans-serif, system-ui, sans-serif` | Body text (system font stack) |
| Font size base | `1rem` (16px) | Body |
| Heading scale | DaisyUI default (1.75rem → 1.25rem → 1rem) | h1 → h2 → h3 |

---

## Page Layout Taxonomy

### Layout Type A: Public (Unauthenticated) — Centered Card

Applies to: `login.html`, `setup.html`, `reset-request.html`, `reset-complete.html`

```
┌─────────────────────────────────────┐
│           (full-height bg)          │
│    ┌───────────────────────────┐    │
│    │         Logo / Title      │    │
│    │       ─────────────       │    │
│    │         Form fields       │    │
│    │         Submit button     │    │
│    │         Footer link       │    │
│    └───────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

DaisyUI classes: `min-h-screen flex items-center justify-center bg-base-200` (outer);
`card w-full max-w-md bg-base-100 shadow-xl` (card); `card-body` (content area)

### Layout Type B: Authenticated — Navbar + Content

Applies to: `index.html`, `profile.html`, `admin.html`

```
┌───────────────────────────────────────────────┐
│  [Logo]  Dashboard  Profile  [Admin]  [Logout] │  ← navbar (desktop)
├───────────────────────────────────────────────┤
│                                               │
│            Main content area                  │
│            (sections / cards)                 │
│                                               │
└───────────────────────────────────────────────┘

Mobile (< 768px):
┌───────────────────────────┐
│  [Logo]           ☰       │  ← navbar with hamburger
│  ─────────────────────── │
│  Main content             │
│  ...                      │
└───────────────────────────┘
```

DaisyUI classes: `navbar bg-base-100 shadow-sm` (top bar); `drawer` or `collapse` for mobile menu;
`container mx-auto px-4 py-6` (main content wrapper)

---

## Component State Inventory

### User Status Badge

| Status | DaisyUI class | Color |
|--------|--------------|-------|
| Active | `badge badge-success` | Green |
| Deactivated | `badge badge-error` | Red |
| Pending email confirmation | `badge badge-warning` | Yellow/amber |

### Button States

| State | DaisyUI class / modifier |
|-------|--------------------------|
| Default primary | `btn btn-primary` |
| Loading | `btn btn-primary loading` |
| Disabled | `btn btn-primary` + `disabled` attr |
| Destructive | `btn btn-error` |
| Secondary / ghost | `btn btn-ghost` or `btn btn-neutral` |

### Form Error State

| State | DaisyUI class |
|-------|--------------|
| Input with error | `input input-bordered input-error` |
| Error message | `label-text-alt text-error` (inside `<label>`) |

---

## Stable DOM Identifier Contract

Every interactive element and dynamically generated element MUST carry a stable identifier that
survives CSS class changes. The following table records identifiers that were already present in the
HTML source (via `id` attributes) and those that must be added.

### Must-add identifiers (entry table rows — generated by `ui.ts`)

| Element | Required attribute | Value pattern |
|---------|-------------------|---------------|
| Weight cell in entry row | `data-cell="weight"` | static |
| Date cell in entry row | `data-cell="date"` | static |
| Time cell in entry row | `data-cell="time"` | static |
| Actions cell in entry row | `data-cell="actions"` | static |
| Empty state element | `id="entry-empty-state"` | static |

### Existing stable identifiers (no change needed)

All `id` attributes already present across HTML pages (e.g., `logout-button`, `weight-input`,
`unit-select`, `export-btn`, `cu-username`, `audit-apply-btn`, etc.) are already stable and must
not be changed.

---

## Responsive Breakpoint Contract

| Breakpoint | Viewport | Navbar behavior | Card behavior |
|------------|----------|-----------------|---------------|
| Mobile | < 768px | Hamburger menu | Full-width card with `px-4` |
| Tablet/Desktop | ≥ 768px | Horizontal navbar | Max-width card centered |
