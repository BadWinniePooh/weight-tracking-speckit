# Quickstart & Manual Validation: Weight Chart Visualization

**Feature**: 002-chart-visualization
**Created**: 2026-03-13

---

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
```

---

## Checkpoint 1 — Chart hidden with no data

1. Open the app in a fresh browser profile (or clear localStorage).
2. **Verify**: No chart section is visible on the page.
3. **Verify**: The entry form is the first element visible in `<main>`.

---

## Checkpoint 2 — Chart appears on first entry; trendline after second

1. Log one weight entry (any value).
2. **Verify**: The chart section appears above the entry form with a single data point.
3. **Verify**: No trendline is drawn.
4. **Verify**: The informational message "Corridor lines require 7 days of data and a configured weight goal." is visible.
5. Log a second entry on a **different calendar day** (advance system clock or manually set a past date by editing localStorage directly for testing).
6. **Verify**: A trendline is now drawn through both data points.

---

## Checkpoint 3 — Settings modal opens, validates, and persists

1. Click the **Settings** button near the chart.
2. **Verify**: A modal dialog opens with `lossRate=0.0055`, `carbFatRatio=0.6`, `bufferValue=0.0075`, and empty `weightGoal`.
3. Enter `-10` in the Weight goal field. Click **Save**.
4. **Verify**: An error is shown; modal stays open; nothing is persisted.
5. Enter `75` in the Weight goal field. Click **Save**.
6. **Verify**: Modal closes; the informational message is still visible (< 7 days of data).
7. Refresh the page.
8. **Verify**: Reopening the modal shows `weightGoal=75`.
9. Open the modal and click **Cancel** (or press Escape).
10. **Verify**: No change to persisted values.

---

## Checkpoint 4 — Corridor lines appear after 7 days

1. Ensure `weightGoal` is set (see Checkpoint 3).
2. Seed localStorage with at least 7 entries across 7 distinct calendar days:
   ```javascript
   // Paste in browser DevTools console:
   const entries = Array.from({length: 8}, (_, i) => ({
     id: crypto.randomUUID(),
     weightValue: 82 - i * 0.3,
     unit: "kg",
     timestamp: new Date(Date.now() - i * 86400000).toISOString()
   }));
   localStorage.setItem("weight_tracker_entries", JSON.stringify(entries));
   location.reload();
   ```
3. **Verify**: Floor, ceiling, and ideal lines are visible from day 7 onward.
4. **Verify**: Days 1–6 show only data points and the trendline — no corridor lines.
5. **Verify**: Floor line is visually below the ideal line; ceiling is above.
6. **Verify**: The informational message is NOT visible.

---

## Checkpoint 5 — Corridor invariant `floor ≤ ideal ≤ ceiling`

1. With corridor lines visible (Checkpoint 4 complete):
2. **Verify** visually on the chart that floor ≤ ideal ≤ ceiling at every rendered day.
3. Open DevTools console — no errors should appear.

---

## Checkpoint 6 — Gap interpolation

1. Seed entries with a gap (entries on day 1 and day 15, none in between):
   ```javascript
   const entries = [
     { id: crypto.randomUUID(), weightValue: 84, unit: "kg", timestamp: new Date(Date.now() - 14 * 86400000).toISOString() },
     { id: crypto.randomUUID(), weightValue: 82, unit: "kg", timestamp: new Date().toISOString() }
   ];
   localStorage.setItem("weight_tracker_entries", JSON.stringify(entries));
   // Ensure weightGoal is set
   localStorage.setItem("weight_tracker_chart_settings", JSON.stringify({ weightGoal: 75, lossRate: 0.0055, carbFatRatio: 0.6, bufferValue: 0.0075 }));
   location.reload();
   ```
2. **Verify**: Corridor lines (floor/ceiling/ideal) are drawn as continuous lines across the gap — no breaks.
3. **Verify**: Only 2 data points are rendered (no interpolated points visible).

---

## Checkpoint 7 — Mixed units

1. Seed entries with mixed units:
   ```javascript
   const entries = [
     { id: crypto.randomUUID(), weightValue: 82, unit: "kg", timestamp: new Date(Date.now() - 1 * 86400000).toISOString() },
     { id: crypto.randomUUID(), weightValue: 180, unit: "lbs", timestamp: new Date().toISOString() }
   ];
   localStorage.setItem("weight_tracker_entries", JSON.stringify(entries));
   location.reload();
   ```
2. Switch preferred unit to **kg**.
3. **Verify**: Both data points appear in kg on the y-axis (180 lbs ≈ 81.6 kg).
4. Switch preferred unit to **lbs**.
5. **Verify**: Both data points appear in lbs (82 kg ≈ 180.8 lbs).
6. **Verify**: Y-axis label updates to match the selected unit.

---

## Checkpoint 8 — Responsive layout

1. Open Chrome DevTools → Device Toolbar.
2. Set width to **320 px**.
3. **Verify**: Chart is fully visible; no horizontal scroll; axis labels are legible.
4. Set width to **1280 px**.
5. **Verify**: Chart scales up appropriately; no layout overflow.

---

## Checkpoint 9 — weightGoal cleared hides corridor lines

1. With all corridor lines visible, open Settings modal.
2. Clear the Weight goal field. Click **Save**.
3. **Verify**: Corridor lines (floor/ceiling/ideal) disappear.
4. **Verify**: Trendline and data points remain.
5. **Verify**: Informational message reappears.
