import type { WeightEntry, WeightUnit, CorridorState } from "./model";
import { validateWeight, createEntry } from "./model";
import { saveEntries, isDataCorrupt, getRawStorageString } from "./storage";
import { getUnit } from "./preferences";
import { triggerDownload } from "./export";

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
  weightCell.textContent = `${displayValue.toFixed(1)} ${displayUnit}`;

  const dateCell = document.createElement("td");
  dateCell.className = "entry-date";
  dateCell.textContent = dateFormatter.format(date);

  const timeCell = document.createElement("td");
  timeCell.className = "entry-time";
  timeCell.textContent = timeFormatter.format(date);

  const actionsCell = document.createElement("td");
  actionsCell.className = "entry-actions";

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
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

export function renderEntryList(entries: WeightEntry[]): void {
  const list = document.getElementById("entry-list");
  if (!list) return;

  list.innerHTML = "";

  if (entries.length === 0) {
    const msg = document.createElement("p");
    msg.className = "empty-state";
    msg.textContent = "No entries yet — log your first weight above.";
    list.appendChild(msg);
    return;
  }

  const displayUnit = getUnit();

  // Sort newest-first before rendering
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const table = document.createElement("table");
  table.className = "entry-table";

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
  deleteAllBtn.setAttribute("data-action", "delete-all");
  deleteAllBtn.setAttribute("aria-label", "Delete all entries");
  actionsTh.appendChild(deleteAllBtn);
  headerRow.appendChild(actionsTh);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const entry of sorted) {
    tbody.appendChild(renderEntry(entry, displayUnit));
  }
  table.appendChild(tbody);

  list.appendChild(table);
}

// ─── Form submission (US1) ────────────────────────────────────────────────────

export function handleSubmit(_event: Event): void {
  const input = document.getElementById("weight-input") as HTMLInputElement | null;
  const unitSelect = document.getElementById("unit-select") as HTMLSelectElement | null;
  if (!input) return;

  const unit = (unitSelect?.value ?? getUnit()) as "kg" | "lbs";
  const validation = validateWeight(input.value, unit);

  if (!validation.valid) {
    showError(validation.error ?? "Invalid entry.");
    return;
  }

  clearError();
  const entry = createEntry(Number(input.value.trim()), unit);

  try {
    _entries = [entry, ..._entries];
    saveEntries(_entries);
  } catch (err) {
    showError((err as Error).message);
    _entries = _entries.slice(1); // rollback
    return;
  }

  renderEntryList(_entries);
  input.value = "";
}

// ─── Delete handler (US3) ─────────────────────────────────────────────────────

export function handleDelete(id: string): void {
  if (!window.confirm("Delete this entry?")) return;
  _entries = _entries.filter((e) => e.id !== id);
  saveEntries(_entries);
  renderEntryList(_entries);
}

export function handleDeleteAll(): void {
  if (!window.confirm("Delete all entries? This cannot be undone.")) return;
  _entries = [];
  saveEntries(_entries);
  renderEntryList(_entries);
}

// ─── Recovery screen (FR-013) ─────────────────────────────────────────────────

export function renderRecoveryScreen(): void {
  const downloadBtn = document.getElementById("download-raw-btn");
  const resetBtn = document.getElementById("reset-btn");

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const raw = getRawStorageString();
      const blob = new Blob([raw], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "weight-data-raw.txt";
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.clear();
      location.reload();
    });
  }
}

export function renderApp(corrupt: boolean): void {
  const recovery = document.getElementById("recovery-screen");
  const app = document.getElementById("app");
  if (!recovery || !app) return;

  if (corrupt) {
    recovery.hidden = false;
    app.hidden = true;
    renderRecoveryScreen();
  } else {
    recovery.hidden = true;
    app.hidden = false;
  }
}
