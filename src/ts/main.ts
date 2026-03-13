import { loadEntries, saveEntries, isDataCorrupt, loadChartSettings, saveChartSettings } from "./storage";
import { getUnit, setUnit } from "./preferences";
import {
  renderApp,
  renderEntryList,
  handleSubmit,
  handleDelete,
  handleDeleteAll,
  initEntries,
  getEntries,
  showChartSection,
  hideChartSection,
} from "./ui";
import { generateCSV, generateJSON, formatExportFilename, triggerDownload } from "./export";
import { computeChartData } from "./chart-calculations";
import { renderChart } from "./chart";
import type { WeightUnit, ChartSettings } from "./model";
import type { Chart } from "chart.js";

// ─── Chart instance (kept to destroy before re-render) ────────────────────────
let _chartInstance: Chart | null = null;

function refreshChart(): void {
  const entries = loadEntries();
  const settings = loadChartSettings();
  const unit = getUnit();
  const dataset = computeChartData(entries, settings, unit);

  if (dataset.corridorState === "no-data") {
    hideChartSection();
    return;
  }

  const canvas = document.getElementById("chart-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  if (_chartInstance) {
    _chartInstance.destroy();
    _chartInstance = null;
  }

  _chartInstance = renderChart(canvas, dataset, unit);
  showChartSection(dataset.corridorState);
}

// ─── Settings modal ───────────────────────────────────────────────────────────

function openSettingsModal(): void {
  const dialog = document.getElementById("chart-settings-modal") as HTMLDialogElement | null;
  if (!dialog) return;

  const settings = loadChartSettings();
  const goalInput = document.getElementById("weight-goal-input") as HTMLInputElement | null;
  const lossInput = document.getElementById("loss-rate-input") as HTMLInputElement | null;
  const carbInput = document.getElementById("carb-fat-ratio-input") as HTMLInputElement | null;
  const bufferInput = document.getElementById("buffer-value-input") as HTMLInputElement | null;

  if (goalInput) goalInput.value = settings.weightGoal !== null ? String(settings.weightGoal) : "";
  if (lossInput) lossInput.value = String(settings.lossRate);
  if (carbInput) carbInput.value = String(settings.carbFatRatio);
  if (bufferInput) bufferInput.value = String(settings.bufferValue);

  // Clear any previous field errors
  ["weight-goal-error", "loss-rate-error", "carb-fat-error", "buffer-error"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });

  dialog.showModal();
  goalInput?.focus();
}

function closeSettingsModal(): void {
  const dialog = document.getElementById("chart-settings-modal") as HTMLDialogElement | null;
  dialog?.close();
}

function validateSettingsForm(): ChartSettings | null {
  const goalInput = document.getElementById("weight-goal-input") as HTMLInputElement;
  const lossInput = document.getElementById("loss-rate-input") as HTMLInputElement;
  const carbInput = document.getElementById("carb-fat-ratio-input") as HTMLInputElement;
  const bufferInput = document.getElementById("buffer-value-input") as HTMLInputElement;

  let valid = true;

  function clearErr(id: string) {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  }
  function setErr(id: string, msg: string) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
    valid = false;
  }

  clearErr("weight-goal-error");
  clearErr("loss-rate-error");
  clearErr("carb-fat-error");
  clearErr("buffer-error");

  // weightGoal — optional but must be positive if provided
  let weightGoal: number | null = null;
  if (goalInput.value.trim() !== "") {
    const gVal = Number(goalInput.value);
    if (isNaN(gVal) || goalInput.value.trim() === "") {
      setErr("weight-goal-error", "Please enter a valid number.");
    } else if (gVal <= 0) {
      setErr("weight-goal-error", "Weight goal must be a positive number.");
    } else {
      weightGoal = gVal;
    }
  }

  // lossRate — required, > 0
  const lossVal = Number(lossInput.value);
  if (isNaN(lossVal) || lossInput.value.trim() === "") {
    setErr("loss-rate-error", "Please enter a valid number.");
  } else if (lossVal <= 0) {
    setErr("loss-rate-error", "Loss rate must be greater than zero.");
  }

  // carbFatRatio — required, > 0
  const carbVal = Number(carbInput.value);
  if (isNaN(carbVal) || carbInput.value.trim() === "") {
    setErr("carb-fat-error", "Please enter a valid number.");
  } else if (carbVal <= 0) {
    setErr("carb-fat-error", "Carb/fat ratio must be greater than zero.");
  }

  // bufferValue — required, > 0
  const bufferVal = Number(bufferInput.value);
  if (isNaN(bufferVal) || bufferInput.value.trim() === "") {
    setErr("buffer-error", "Please enter a valid number.");
  } else if (bufferVal <= 0) {
    setErr("buffer-error", "Buffer value must be greater than zero.");
  }

  if (!valid) return null;
  return { weightGoal, lossRate: lossVal, carbFatRatio: carbVal, bufferValue: bufferVal };
}

// ─── DOMContentLoaded ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const entries = loadEntries();
  const corrupt = isDataCorrupt();

  renderApp(corrupt);

  if (corrupt) return;

  initEntries(entries);

  // Set unit selector to persisted preference
  const unit = getUnit();
  const unitSelect = document.getElementById("unit-select") as HTMLSelectElement | null;
  if (unitSelect) unitSelect.value = unit;

  renderEntryList(entries);
  refreshChart();

  // Unit preference change — re-render history list and chart with new unit (FR-015, C1)
  unitSelect?.addEventListener("change", () => {
    setUnit(unitSelect.value as WeightUnit);
    renderEntryList(getEntries());
    refreshChart();
  });

  // Submit button click
  const submitBtn = document.getElementById("submit-btn");
  submitBtn?.addEventListener("click", (e) => {
    handleSubmit(e);
    refreshChart();
  });

  // Enter key in weight input
  const weightInput = document.getElementById("weight-input");
  weightInput?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      handleSubmit(e);
      refreshChart();
    }
  });

  // Click delegation for delete buttons
  const entryList = document.getElementById("entry-list");
  entryList?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute("data-action") === "delete") {
      const id = target.getAttribute("data-id");
      if (id) {
        handleDelete(id);
        refreshChart();
      }
    } else if (target.getAttribute("data-action") === "delete-all") {
      handleDeleteAll();
      refreshChart();
    }
  });

  // Export button
  const exportBtn = document.getElementById("export-btn");
  exportBtn?.addEventListener("click", () => {
    const formatSelect = document.getElementById("export-format") as HTMLSelectElement | null;
    const format = (formatSelect?.value ?? "csv") as "csv" | "json";
    const currentEntries = loadEntries();

    if (format === "csv") {
      const content = generateCSV(currentEntries);
      triggerDownload(content, formatExportFilename("csv"), "text/csv");
    } else {
      const content = generateJSON(currentEntries);
      triggerDownload(content, formatExportFilename("json"), "application/json");
    }
  });

  // Chart settings button
  const settingsBtn = document.getElementById("chart-settings-btn");
  settingsBtn?.addEventListener("click", openSettingsModal);

  // Settings modal: cancel and Escape
  const settingsModal = document.getElementById("chart-settings-modal") as HTMLDialogElement | null;
  const cancelBtn = document.getElementById("settings-cancel-btn");
  cancelBtn?.addEventListener("click", closeSettingsModal);
  settingsModal?.addEventListener("cancel", closeSettingsModal);

  // Settings modal: backdrop click closes (C2)
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  // Settings modal: Enter key in input does NOT submit (C3)
  const settingsForm = document.getElementById("chart-settings-form");
  settingsForm?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
    }
  });

  // Settings modal: save
  const saveBtn = document.getElementById("settings-save-btn");
  saveBtn?.addEventListener("click", () => {
    const validated = validateSettingsForm();
    if (!validated) return; // errors shown inline, modal stays open
    saveChartSettings(validated);
    closeSettingsModal();
    refreshChart();
  });
});
