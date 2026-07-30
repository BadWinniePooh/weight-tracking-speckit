# UI Contract: Minimal Weight Tracker

**Type**: UI interaction contract (form inputs, events, rendered output)
**Version**: 1.0.0
**Date**: 2026-03-13

This contract defines the expected inputs, outputs, and behaviours of the app's
two primary UI surfaces: the entry form and the history list. Tests MUST verify
these contracts before the implementation is considered complete.

---

## Entry Form

### Inputs

| Input         | Type     | Constraints                                      |
|---------------|----------|--------------------------------------------------|
| Weight field  | number   | Required; numeric; within plausible range for unit |
| Submit action | user gesture (click/tap or Enter key) | N/A       |

### Outputs on Valid Submission

- A new `WeightEntry` is prepended to the history list immediately (no page reload).
- The weight input field is cleared.
- No error message is displayed.

### Outputs on Invalid Submission

- No entry is created.
- The weight input field retains its value so the user can correct it.
- A descriptive inline error message is displayed adjacent to the field.
- Specific error messages (see data-model.md Validation Rules).

---

## Unit Preference Selector

### Inputs

| Input          | Type   | Values            |
|----------------|--------|-------------------|
| Unit selection | toggle | `"kg"` or `"lbs"` |

### Outputs on Change

- The selected unit is persisted immediately.
- The entry form label reflects the new unit.
- All entries in the history list display with their stored unit label
  (no conversion is performed on historical data).

---

## History List

### Rendered Output Per Entry

Each entry row MUST display:

| Field         | Format                              | Example              |
|---------------|-------------------------------------|----------------------|
| Weight value  | Number to 1 decimal place + unit   | `82.5 kg`            |
| Date          | Human-readable local date           | `13 Mar 2026`        |
| Time          | 24-hour or 12-hour local time       | `09:15` or `9:15 AM` |
| Delete action | Button/icon with accessible label   | "Delete entry"       |

### Empty State

When no entries exist, the list area MUST display a non-error empty-state message
(e.g., "No entries yet — log your first weight above.").

---

## Delete Confirmation

### Flow

1. User activates the delete control on an entry.
2. App presents a confirmation prompt (native `confirm()` dialog or inline confirm
   UI — either is acceptable).
3. If confirmed: entry is removed from the list and from localStorage immediately.
4. If cancelled: no change occurs.

### Outputs After Confirmed Delete

- The deleted entry no longer appears in the list.
- The list reflects the correct remaining entries.
- If the last entry is deleted, the empty-state message is shown.

---

## Responsive Layout Contract

| Breakpoint         | Width       | Required Layout Behaviour                            |
|--------------------|-------------|------------------------------------------------------|
| Mobile             | ≥ 320 px    | Single-column; all controls reachable without zoom   |
| Desktop            | ≥ 1024 px   | Wider layout acceptable; no horizontal scroll        |
| Both               | Any ≥ 320 px| No horizontal overflow; text is legible without zoom |
