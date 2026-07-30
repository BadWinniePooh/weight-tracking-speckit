import type { WeightEntry, WeightUnit, CorridorState } from "./model";

// ─── Unit conversion ──────────────────────────────────────────────────────────

function convertWeight(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === "kg" && toUnit === "lbs") return value * 2.20462;
  return value * 0.453592; // lbs → kg
}

// In-memory entries array — managed by this module
let _entries: WeightEntry[] = [];

export function initEntries(entries: WeightEntry[]): void {
  _entries = entries;
}

export function getEntries(): WeightEntry[] {
  return _entries;
}

// ─── Chart section visibility (FR-004, FR-019) ───────────────────────────────

const INFO_MSG = "Corridor lines require 7 days of data and a configured weight goal.";

export function showChartSection(corridorState: CorridorState): void {
  const section = document.getElementById("chart-section");
  if (section) section.hidden = false;
  const msg = document.getElementById("chart-info-msg");
  if (msg) {
    msg.textContent =
      corridorState === "no-goal" || corridorState === "calibrating" ? INFO_MSG : "";
  }
}

export function hideChartSection(): void {
  const section = document.getElementById("chart-section");
  if (section) section.hidden = true;
}

// ─── Error display ────────────────────────────────────────────────────────────

export function showError(msg: string): void {
  const el = document.getElementById("error-msg");
  if (el) el.textContent = msg;
}

export function clearError(): void {
  const el = document.getElementById("error-msg");
  if (el) el.textContent = "";
}

// ─── Entry rendering ──────────────────────────────────────────────────────────

export function renderEntry(entry: WeightEntry, displayUnit: WeightUnit = entry.unit): HTMLElement {
  const row = document.createElement("tr");
  row.setAttribute("data-id", entry.id);
  row.className = "entry-row";

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Date(entry.timestamp);

  const displayValue = convertWeight(entry.weightValue, entry.unit, displayUnit);
  const weightCell = document.createElement("td");
  weightCell.className = "entry-weight";
  weightCell.setAttribute("data-cell", "weight");
  weightCell.textContent = `${displayValue.toFixed(1)} ${displayUnit}`;

  const dateCell = document.createElement("td");
  dateCell.className = "entry-date";
  dateCell.setAttribute("data-cell", "date");
  dateCell.textContent = dateFormatter.format(date);

  const timeCell = document.createElement("td");
  timeCell.className = "entry-time";
  timeCell.setAttribute("data-cell", "time");
  timeCell.textContent = timeFormatter.format(date);

  const actionsCell = document.createElement("td");
  actionsCell.className = "entry-actions";
  actionsCell.setAttribute("data-cell", "actions");

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "btn btn-sm btn-error";
  deleteBtn.setAttribute("aria-label", "Delete entry");
  deleteBtn.setAttribute("data-action", "delete");
  deleteBtn.setAttribute("data-id", entry.id);
  actionsCell.appendChild(deleteBtn);

  row.appendChild(weightCell);
  row.appendChild(dateCell);
  row.appendChild(timeCell);
  row.appendChild(actionsCell);
  return row;
}

export function renderEntryList(entries: Array<{ id: string; weightValue: number; unit: string; timestamp: string }>, displayUnit?: string): void {
  const list = document.getElementById("entry-list");
  if (!list) return;

  list.innerHTML = "";

  if (entries.length === 0) {
    const msg = document.createElement("p");
    msg.id = "entry-empty-state";
    msg.className = "empty-state";
    msg.textContent = "No entries yet — log your first weight above.";
    list.appendChild(msg);
    return;
  }

  const resolvedDisplayUnit = (displayUnit ?? "kg") as WeightUnit;

  // Sort newest-first before rendering
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const table = document.createElement("table");
  table.className = "entry-table table table-zebra w-full";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const text of ["Weight", "Date", "Time"]) {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  }
  const actionsTh = document.createElement("th");
  const deleteAllBtn = document.createElement("button");
  deleteAllBtn.textContent = "Delete all";
  deleteAllBtn.className = "btn btn-sm btn-error";
  deleteAllBtn.setAttribute("data-action", "delete-all");
  deleteAllBtn.setAttribute("aria-label", "Delete all entries");
  actionsTh.appendChild(deleteAllBtn);
  headerRow.appendChild(actionsTh);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const entry of sorted) {
    tbody.appendChild(renderEntry(entry as WeightEntry, resolvedDisplayUnit));
  }
  table.appendChild(tbody);

  list.appendChild(table);
}

// ─── API loading / error state ────────────────────────────────────────────────

export function showApiLoading(): void {
  const el = document.getElementById("loading-indicator");
  if (el) el.hidden = false;
}

export function hideApiLoading(): void {
  const el = document.getElementById("loading-indicator");
  if (el) el.hidden = true;
}

export function showApiError(msg: string): void {
  const el = document.getElementById("api-error-banner");
  if (el) {
    el.textContent = msg;
    el.hidden = false;
  }
}

export function clearApiError(): void {
  const el = document.getElementById("api-error-banner");
  if (el) {
    el.textContent = "";
    el.hidden = true;
  }
}

// ─── Migration banner ─────────────────────────────────────────────────────────

export function showMigrationButton(onClick: () => Promise<void>): void {
  const existing = document.getElementById("migration-banner");
  if (existing) return; // already shown

  const banner = document.createElement("div");
  banner.id = "migration-banner";
  banner.className = "migration-banner";

  const msg = document.createElement("p");
  msg.textContent = "You have weight data from a previous version.";

  const btn = document.createElement("button");
  btn.id = "migration-btn";
  btn.textContent = "Import from previous version";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Importing\u2026";
    try {
      await onClick();
    } finally {
      // onClick is responsible for hiding/removing the banner
    }
  });

  banner.appendChild(msg);
  banner.appendChild(btn);

  // Insert before #app
  const app = document.getElementById("app");
  if (app) app.parentNode?.insertBefore(banner, app);
}

export function hideMigrationButton(): void {
  const el = document.getElementById("migration-banner");
  el?.remove();
}

export function showMigrationResult(result: { migratedEntries: number; skippedEntries: number; skippedReasons: string[] }): void {
  const el = document.getElementById("migration-result");
  if (!el) return;

  let msg = `Migrated ${result.migratedEntries} entries.`;
  if (result.skippedEntries > 0) {
    msg += ` Skipped ${result.skippedEntries}.`;
  }
  el.textContent = msg;
  el.hidden = false;
}

export function renderApp(_corrupt?: boolean): void {
  const app = document.getElementById("app");
  if (app) app.hidden = false;
}
