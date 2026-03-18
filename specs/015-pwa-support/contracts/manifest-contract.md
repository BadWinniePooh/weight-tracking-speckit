# Contract: Web App Manifest

The web app manifest is a public document served at `/manifest.webmanifest` that browsers read to determine installability and app presentation. It is a contract between the application and the browser (and, by extension, the operating system).

## Required Fields

| Field            | Value                  | Notes                                              |
|------------------|------------------------|----------------------------------------------------|
| `name`           | `"Weight Tracker"`     | Full app name shown in install dialogs and splash  |
| `short_name`     | `"WeightTracker"`      | Truncated name shown on home screen icon label     |
| `start_url`      | `"/"`                  | Entry point when app is launched from home screen  |
| `display`        | `"standalone"`         | Hides browser chrome; required for installability  |
| `theme_color`    | Hex color string       | Browser UI colour matching the app's primary tone  |
| `background_color` | Hex color string     | Splash screen background before app paint          |
| `icons`          | Array (see below)      | At minimum: 192×192 and 512×512 PNG                |

## Icon Contract

| `src`                    | `sizes`     | `type`       | Required? |
|--------------------------|-------------|--------------|-----------|
| `/icons/icon-192.png`    | `192x192`   | `image/png`  | Yes       |
| `/icons/icon-512.png`    | `512x512`   | `image/png`  | Yes       |

## Service Worker Contract

A service worker must be registered at the root scope (`/`) and must respond to `fetch` events. File is served at `/sw.js`.

## Installability Invariants

The following must hold in production for Chrome to offer the install prompt:

1. `manifest.webmanifest` is served with `Content-Type: application/manifest+json`
2. `sw.js` is served at the root of the site
3. All icon files referenced in the manifest exist and are accessible over HTTPS
4. The `display` field is set to `standalone`, `minimal-ui`, or `fullscreen`
5. The site is served over HTTPS (enforced by Traefik)
