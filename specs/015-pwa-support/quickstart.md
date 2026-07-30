# Quickstart: PWA Support (015-pwa-support)

## Prerequisites

- Node.js 20+, npm 10+
- `frontend/` directory
- The app running over HTTPS in production (Traefik already configured)

## Install the Plugin

```bash
cd frontend
npm install --save-dev vite-plugin-pwa
```

## Add Icons

Create `frontend/public/icons/` and add two PNG icon files:

```
frontend/public/icons/icon-192.png   (192×192 pixels)
frontend/public/icons/icon-512.png   (512×512 pixels)
```

A simple solid-colour placeholder with a scale letter ("W") is sufficient. Any PNG image editing tool works. The files must be committed to the repository.

## Configure vite-plugin-pwa

In `frontend/vite.config.ts`, add the `VitePWA` plugin and set `publicDir` explicitly (required because this project uses `root: "src"`, which would otherwise resolve `publicDir` relative to `src/` instead of the project root):

```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        globPatterns: [],   // no asset precaching — installability only
      },
      manifest: {
        name: 'Weight Tracker',
        short_name: 'WeightTracker',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  root: "src",
  publicDir: "../public",   // required — resolves public/ relative to project root, not src/
  // ... rest of config unchanged
})
```

The plugin automatically injects `<link rel="manifest">` and the SW registration script into all 8 HTML entry points at build time. No manual HTML changes are needed.

## Run Tests First (TDD)

Write the Vitest build-output tests in `tests/pwa/pwa-build.test.ts` before the plugin is configured. The tests will fail until the build is correct. Run them with:

```bash
cd frontend
npm run build
npm test
```

## Verify Installability

After building and deploying:

1. Open Chrome on Android (or Chrome desktop), navigate to the app URL
2. Open DevTools → Application → Manifest — verify no errors
3. Open DevTools → Application → Service Workers — verify SW is registered
4. On Android: Chrome will show an install banner or an install icon in the address bar
5. Install the app and confirm it opens without browser chrome

## Notes

- The install prompt will NOT appear on `localhost` in most cases — test against your HTTPS production or staging URL
- iOS: no install prompt; users must manually use Share → Add to Home Screen
- Cache invalidation is automatic — no action needed on new deploys
