# Design System: Weight Tracker

**Feature**: 009-tailwind-daisyui-redesign
**Stack**: Tailwind CSS v3 + DaisyUI v4
**Themes**: `light` (default) + `dark` (auto via `prefers-color-scheme: dark`)

---

## Color Palette

All colors are defined as DaisyUI CSS variable overrides in `frontend/src/css/main.css`.

### DaisyUI Token Reference

| Token | CSS var | Light value (HSL) | Dark value (HSL) | Usage |
|-------|---------|-------------------|------------------|-------|
| Primary | `--p` | `160 84% 39%` (emerald-600) | `160 84% 60%` (emerald-400) | CTA buttons, active states |
| Primary Content | `--pc` | `0 0% 100%` (white) | `220 9% 10%` (near-black) | Text on primary bg |
| Accent | `--a` | `38 92% 50%` (amber-500) | `38 92% 65%` (amber-400) | Secondary actions, highlights |
| Accent Content | `--ac` | `220 9% 10%` | `220 9% 10%` | Text on accent bg |
| Success | `--su` | `152 68% 31%` (green-700) | `160 84% 60%` (emerald-400) | Active status badges |
| Error | `--er` | `0 72% 51%` (red-600) | `0 91% 71%` (red-400) | Error messages, destructive actions |
| Warning | `--wa` | `38 92% 50%` (amber-500) | `38 92% 65%` (amber-400) | Pending status badges |
| Base 100 | `--b1` | `0 0% 100%` (white) | `221 39% 11%` (slate-900) | Card backgrounds |
| Base 200 | `--b2` | `210 20% 98%` (slate-50) | `215 28% 17%` (slate-800) | Page background |
| Base 300 | `--b3` | `220 14% 96%` (slate-100) | `217 19% 27%` (slate-700) | Borders, dividers |
| Base Content | `--bc` | `221 39% 11%` (slate-900) | `210 20% 98%` (slate-50) | Body text |
| Neutral | `--n` | `220 9% 46%` (slate-500) | `218 11% 65%` (slate-400) | Secondary text |
| Neutral Content | `--nc` | `0 0% 100%` | `221 39% 11%` | Text on neutral bg |

### Rationale

- **Emerald/teal primary** (`#10b981` family): energetic without clinical coldness; associated with health, vitality, and progress.
- **Amber accent** (`#f59e0b` family): warmth and motivation; pairs with emerald for a fitness-forward palette.
- **DaisyUI `light` + `dark` base themes**: most neutral starting point; fully customizable via CSS variables. Custom theme from scratch was rejected (over-engineering).
- **No manual theme toggle**: OS preference drives the scheme via `prefers-color-scheme: dark`. `theme.ts` handles live switching without page reload.

---

## Typography

- **Font stack**: System UI stack via DaisyUI default — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Heading scale**: Tailwind utility classes (`text-2xl font-bold`, `text-xl font-semibold`, etc.)
- **Body**: `text-base` (16px), `text-sm` (14px) for secondary/feedback text
- **No custom font import**: avoids extra network request; system fonts render natively on all platforms

---

## Component Guidelines

### Buttons

| Use Case | Classes |
|----------|---------|
| Primary CTA | `btn btn-primary` |
| Secondary/ghost | `btn btn-ghost` |
| Destructive | `btn btn-error` |
| Small table action | `btn btn-sm btn-ghost` |
| Destructive small | `btn btn-sm btn-ghost text-error` |
| Full-width form submit | `btn btn-primary w-full` |

**Loading state**: set `disabled`, `data-loading="true"`, and `loading` class before API call; remove all three in `finally` block.

### Inputs & Forms

| Element | Classes |
|---------|---------|
| Text/email/password input | `input input-bordered w-full` |
| Select dropdown | `select select-bordered` or `select select-bordered w-full` |
| Small filter input | `input input-bordered input-sm` |
| Small filter select | `select select-bordered select-sm` |
| Form field wrapper | `form-control mb-4` |
| Field label | `label` + inner `label-text` span |
| Error message | `text-error text-sm` |

### Cards

| Use Case | Classes |
|----------|---------|
| Content card | `card bg-base-100 shadow` + inner `card-body` |
| Card heading | `card-title` |
| Authenticated page layout | container with `mx-auto px-4 py-6` inside card wrappers |

### Public Page Layout

Centered fullscreen card — no navbar:
```html
<div id="public-page-root" class="min-h-screen flex items-center justify-center bg-base-200">
  <div id="auth-card" class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 id="page-title" class="card-title">…</h2>
      <!-- form fields -->
    </div>
  </div>
</div>
```

### Navigation (Authenticated Pages)

DaisyUI `navbar` component:
- Desktop (≥ 768px): horizontal menu via `.navbar-center .menu.menu-horizontal`
- Mobile (< 768px): hamburger button (`#nav-hamburger`) toggles `#nav-mobile-menu` via `hidden` attribute
- Role-based: `#nav-admin` and `#nav-mobile-admin` hidden for non-admin users (controlled by `navbar.ts`)
- Active page: `aria-current="page"` on the current page's link

### Tables

| Use Case | Classes |
|----------|---------|
| Data table | `table table-zebra w-full` |
| Responsive wrapper | `overflow-x-auto` |

### Status Badges

| Status | Classes | `data-status` |
|--------|---------|---------------|
| Active | `badge badge-success` | `active` |
| Deactivated | `badge badge-error` | `inactive` |
| Pending confirmation | `badge badge-warning` | `pending` |

Always include `data-status` for test/script querying — do not rely on badge text for logic.

### Modals (DaisyUI `<dialog>`)

```html
<dialog id="my-modal" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Title</h3>
    <p class="py-4">Body content.</p>
    <div class="modal-action">
      <button class="btn btn-primary">Confirm</button>
      <button class="btn">Cancel</button>
    </div>
  </div>
</dialog>
```

Open with `modal.showModal()`, close with `modal.close()`. Never use `window.confirm()` for destructive actions.

### Stats Bar

DaisyUI `stats` component for admin dashboard metrics:
```html
<div class="stats shadow w-full stats-vertical lg:stats-horizontal">
  <div class="stat">
    <div class="stat-title">Label</div>
    <div class="stat-value" id="stat-…">—</div>
    <div class="stat-desc">Description</div>
  </div>
</div>
```

Stats must update in-place after mutations — call `refreshStats(users)` after every mutating API call.

### Pagination

Use `join` + `btn btn-sm btn-ghost` for Previous/Next pairs:
```html
<div class="join">
  <button class="join-item btn btn-sm btn-ghost">Previous</button>
  <button class="join-item btn btn-sm btn-ghost">Next</button>
</div>
```

---

## Spacing & Layout Conventions

- **Authenticated pages**: `<main class="container mx-auto px-4 py-6">` inside `#app` div after navbar
- **Public pages**: `min-h-screen flex items-center justify-center bg-base-200` wrapper; card constrained to `max-w-md`
- **Section spacing**: `mb-6` between major sections
- **Form field spacing**: `mb-4` between form controls

---

## Icon Policy

- **Inline SVG only** (Heroicons style) — no npm icon library
- Icons are embedded directly in HTML where needed (e.g., hamburger menu, chart icons)
- This avoids extra bundle weight and eliminates a runtime dependency

---

## Datetime Formatting

- **Audit log timestamps**: `YYYY-MM-DD HH:mm` in the user's local timezone, produced by `new Date(iso).toLocaleString("sv-SE").slice(0, 16)`
- **Date-only fields** (lastLogin, scheduledDeletion): `YYYY-MM-DD` via `iso.slice(0, 10)`

---

## OS Theme Switching

- `theme.ts` reads `window.matchMedia("(prefers-color-scheme: dark)")` on load and sets `data-theme="dark"|"light"` on `<html>`
- A `change` event listener updates `data-theme` live (no page reload required)
- No localStorage — theme is always derived from the current OS preference
- `theme.ts` is imported and `initTheme()` called in every page's TypeScript entry point
