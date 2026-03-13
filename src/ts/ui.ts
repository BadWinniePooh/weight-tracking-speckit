import type { WeightEntry } from "./model";
import { validateWeight, createEntry } from "./model";
import { saveEntries, isDataCorrupt, getRawStorageString } from "./storage";
import { getUnit } from "./preferences";
import { triggerDownload } from "./export";

// In-memory entries array — managed by this module
let _entries: WeightEntry[] = [];

export function initEntries(entries: WeightEntry[]): void {
  _entries = entries;
}

export function getEntries(): WeightEntry[] {
  return _entries;
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

export function renderEntry(entry: WeightEntry): HTMLElement {
  const row = document.createElement("div");
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
  const dateStr = dateFormatter.format(date);
  const timeStr = timeFormatter.format(date);

  const info = document.createElement("span");
  info.className = "entry-info";
  info.textContent = `${entry.weightValue.toFixed(1)} ${entry.unit} — ${dateStr} ${timeStr}`;

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete entry";
  deleteBtn.setAttribute("aria-label", "Delete entry");
  deleteBtn.setAttribute("data-action", "delete");
  deleteBtn.setAttribute("data-id", entry.id);

  row.appendChild(info);
  row.appendChild(deleteBtn);
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

  // Sort newest-first before rendering
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  for (const entry of sorted) {
    list.appendChild(renderEntry(entry));
  }
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
