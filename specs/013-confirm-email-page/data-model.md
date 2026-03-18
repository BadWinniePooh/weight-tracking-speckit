# Data Model: Email Confirmation Page

**Feature**: `013-confirm-email-page`
**Date**: 2026-03-18

## Entities

### Email Confirmation Token (read-only, from URL)

| Attribute | Type   | Source               | Validation                                       |
|-----------|--------|----------------------|--------------------------------------------------|
| `token`   | string | URL query param `?token=` | Must be non-empty; backend validates authenticity and expiry |

This is not a persisted entity on the frontend. The token is extracted from `window.location.search` on page load, passed to the API, and discarded. No frontend storage.

## Page State Machine

```
Page Load
    │
    ├─ [No token in URL or empty token]
    │       └─→ ERROR STATE (immediate, no API call)
    │
    └─ [Token present]
            └─→ LOADING STATE
                    │
                    ├─ [API returns 2xx]
                    │       └─→ SUCCESS STATE
                    │
                    └─ [API returns 4xx or network error]
                            └─→ ERROR STATE
```

## DOM Structure

The page uses three mutually exclusive panels toggled via the `hidden` CSS class:

| Panel ID          | Shown When                       | Hidden Initially? |
|-------------------|----------------------------------|-------------------|
| `#loading-panel`  | Token present, request in flight | Yes               |
| `#success-panel`  | API call returned 2xx            | Yes               |
| `#error-panel`    | No token OR API call returned error | Yes            |

Within `#error-panel`, a `#error-message` element holds the user-facing error text (different messages for missing token vs. API failure).

## No Persistent State

- No `localStorage` reads or writes
- No new database columns
- No session state modified
