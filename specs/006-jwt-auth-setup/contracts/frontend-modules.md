# Frontend Module Contracts: Authentication and First-Run Setup

**Feature**: 006-jwt-auth-setup
**Date**: 2026-03-15

---

## New Modules

### `src/ts/auth-token.ts`

In-memory access token store. Token is never written to `localStorage`, `sessionStorage`, or any cookie.

```typescript
export function setAccessToken(token: string): void
export function getAccessToken(): string | null
export function clearAccessToken(): void
```

**Invariants**:
- `getAccessToken()` returns `null` on page load until a successful login or silent refresh
- `clearAccessToken()` must be called on logout and on failed refresh

---

### `src/ts/auth-guard.ts`

Page routing guard. All entry files call this as their first action before rendering any content.

```typescript
export interface AuthState {
  isAuthenticated: boolean
  setupRequired: boolean
  error?: string
}

// Calls GET /api/setup/status then POST /api/auth/refresh.
// Returns the combined auth state without performing any redirects.
export async function checkAuthStatus(): Promise<AuthState>

// Performs redirect if the current page is inappropriate for the given state.
// Must be called immediately after checkAuthStatus().
export function enforceRedirect(
  pageType: "app" | "login" | "setup",
  state: AuthState
): void
```

**Routing table** (enforced by `enforceRedirect`):

| `pageType` | `state` | Action |
|------------|---------|--------|
| `"app"` | `isAuthenticated: true` | No redirect — render |
| `"app"` | `isAuthenticated: false, setupRequired: false` | → `/login.html` |
| `"app"` | `isAuthenticated: false, setupRequired: true` | → `/setup.html` |
| `"login"` | `isAuthenticated: true` | → `/index.html` |
| `"login"` | `setupRequired: true` | → `/setup.html` |
| `"login"` | `isAuthenticated: false, setupRequired: false` | No redirect — render |
| `"setup"` | `setupRequired: true` | No redirect — render |
| `"setup"` | `isAuthenticated: true` | → `/index.html` |
| `"setup"` | `isAuthenticated: false, setupRequired: false` | → `/login.html` |

---

### `src/ts/login.ts` (new entry file)

Entry point for `login.html`. Handles the login form submission.

**Flow**:
1. `DOMContentLoaded` → `checkAuthStatus()` → `enforceRedirect("login", state)`
2. If not redirected: render login form
3. On form submit: `POST /api/auth/login` with `{ username, password }`
4. On 200: `setAccessToken(accessToken)` → navigate to `/index.html`
5. On 401: display "Invalid username or password." inline error
6. On network error: display "Unable to reach server. Please try again."

---

### `src/ts/setup.ts` (new entry file)

Entry point for `setup.html`. Handles the first-run setup form submission.

**Flow**:
1. `DOMContentLoaded` → `checkAuthStatus()` → `enforceRedirect("setup", state)`
2. If not redirected: render setup form
3. Client-side: validate password === confirm password before submit
4. On submit: `POST /api/setup/initialize` with `{ username, email, password }`
5. On 201: navigate to `/login.html`
6. On 409: display "Setup is already complete. Please log in."
7. On 400: display field-specific validation errors inline
8. On network error: display "Unable to reach server. Please try again."

---

## Modified Modules

### `src/ts/main.ts` (modified)

**Changes**:
1. Add as first action inside `DOMContentLoaded`: `checkAuthStatus()` → `enforceRedirect("app", state)`
2. Only proceed to app init (load config, fetch settings, render) if not redirected
3. Add logout button click handler: `POST /api/auth/logout` → `clearAccessToken()` → navigate to `/login.html`

---

### `src/ts/api-client.ts` (modified)

**Changes**:
1. All requests include `Authorization: Bearer <token>` header (from `getAccessToken()`)
2. On 401 response: attempt one silent refresh via `POST /api/auth/refresh` (with `credentials: "include"`)
3. If refresh succeeds: `setAccessToken(newToken)` and retry original request once
4. If refresh fails: `clearAccessToken()` and redirect to `/login.html`
5. Use a promise-based deduplication lock so concurrent 401s trigger only one refresh attempt

---

## Vite Configuration Contract

`vite.config.ts` must declare all three HTML files as explicit entry points:

```typescript
rollupOptions: {
  input: {
    main:  "<root>/index.html",
    login: "<root>/login.html",
    setup: "<root>/setup.html",
  }
}
```

Each HTML file references its own TypeScript entry:
- `index.html` → `<script type="module" src="ts/main.ts">`
- `login.html`  → `<script type="module" src="ts/login.ts">`
- `setup.html`  → `<script type="module" src="ts/setup.ts">`

---

## New HTML Files

### `src/login.html`

Minimal page with:
- Username input (`id="username"`)
- Password input (`id="password"`, `type="password"`)
- Submit button
- Inline error container (`id="error-message"`)
- `<script type="module" src="ts/login.ts">`

### `src/setup.html`

Minimal page with:
- Username input (`id="username"`)
- Email input (`id="email"`, `type="email"`)
- Password input (`id="password"`, `type="password"`)
- Confirm password input (`id="confirm-password"`, `type="password"`)
- Submit button
- Inline error container (`id="error-message"`)
- `<script type="module" src="ts/setup.ts">`

### `src/index.html` (modified)

Add:
- Logout button (`id="logout-button"`) in the app header/toolbar area
