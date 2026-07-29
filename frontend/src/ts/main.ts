import { loadConfig, getApiUrl } from "./config";
import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import { clearAccessToken } from "./auth-token";
import { initNavbar } from "./navbar";
import { initTheme } from "./theme";
import {
  getEntries as fetchEntries,
  createEntry as apiCreateEntry,
  deleteEntry as apiDeleteEntry,
  deleteAllEntries as apiDeleteAllEntries,
  getChartData,
  getSettings,
  updateSettings,
  ApiError,
} from "./api-client";
import {
  renderApp,
  renderEntryList,
  showChartSection,
  hideChartSection,
  showApiLoading,
  hideApiLoading,
  showApiError,
  clearApiError,
  showMigrationButton,
  hideMigrationButton,
  showMigrationResult,
} from "./ui";
import { runMigration, hasMigratableData } from "./migration-tool";
import { generateCSV, generateJSON, formatExportFilename, triggerDownload } from "./export";
import { renderChart } from "./chart";
import { validateWeight } from "./model";
import type { WeightUnit, ChartSettings } from "./model";
import type { Chart } from "chart.js";

let _chartInstance: Chart | null = null;
let _entries: { id: string; weightValue: number; unit: string; timestamp: string }[] = [];
let _preferredUnit: string = "kg";

async function refreshChart(): Promise<void> {
  try {
    const dataset = await getChartData();

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

    _chartInstance = renderChart(canvas, dataset, dataset.unit as WeightUnit);
    showChartSection(dataset.corridorState);
  } catch {
    // Chart errors are non-fatal — entries are still shown
    hideChartSection();
  }
}

async function refreshEntries(): Promise<void> {
  showApiLoading();
  clearApiError();
  try {
    const response = await fetchEntries();
    _entries = response.entries;
    renderEntryList(_entries, _preferredUnit);
    await refreshChart();
  } catch (err) {
    if (err instanceof ApiError) {
      showApiError(err.message);
    } else {
      showApiError("Failed to load entries. Is the server running?");
    }
  } finally {
    hideApiLoading();
  }
}

// ─── Settings modal ───────────────────────────────────────────────────────────

async function openSettingsModal(): Promise<void> {
  const dialog = document.getElementById("chart-settings-modal") as HTMLDialogElement | null;
  if (!dialog) return;

  const settings = await getSettings();
  const goalInput = document.getElementById("weight-goal-input") as HTMLInputElement | null;
  const lossInput = document.getElementById("loss-rate-input") as HTMLInputElement | null;
  const carbInput = document.getElementById("carb-fat-ratio-input") as HTMLInputElement | null;
  const bufferInput = document.getElementById("buffer-value-input") as HTMLInputElement | null;

  if (goalInput) goalInput.value = settings.weightGoal !== null ? String(settings.weightGoal) : "";
  if (lossInput) lossInput.value = settings.lossRate.toFixed(4);
  if (carbInput) carbInput.value = settings.carbFatRatio.toFixed(4);
  if (bufferInput) bufferInput.value = settings.bufferValue.toFixed(4);

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

  const lossVal = Number(lossInput.value);
  if (isNaN(lossVal) || lossInput.value.trim() === "") {
    setErr("loss-rate-error", "Please enter a valid number.");
  } else if (lossVal <= 0) {
    setErr("loss-rate-error", "Loss rate must be greater than zero.");
  }

  const carbVal = Number(carbInput.value);
  if (isNaN(carbVal) || carbInput.value.trim() === "") {
    setErr("carb-fat-error", "Please enter a valid number.");
  } else if (carbVal <= 0) {
    setErr("carb-fat-error", "Carb/fat ratio must be greater than zero.");
  }

  const bufferVal = Number(bufferInput.value);
  if (isNaN(bufferVal) || bufferInput.value.trim() === "") {
    setErr("buffer-error", "Please enter a valid number.");
  } else if (bufferVal <= 0) {
    setErr("buffer-error", "Buffer value must be greater than zero.");
  }

  if (!valid) return null;
  return {
    preferredUnit: _preferredUnit as WeightUnit,
    weightGoal,
    lossRate: lossVal,
    carbFatRatio: carbVal,
    bufferValue: bufferVal,
  };
}

// ─── Logout handler ───────────────────────────────────────────────────────────

export function initLogout(): void {
  const logoutBtn = document.getElementById("logout-button");
  logoutBtn?.addEventListener("click", async () => {
    try {
      await fetch(`${getApiUrl()}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // always clear session regardless of server response
    } finally {
      clearAccessToken();
      window.location.href = "/login.html";
    }
  });
}

// ─── Nav visibility ───────────────────────────────────────────────────────────

export async function applyNavVisibility(): Promise<void> {
  const state = await checkAuthStatus();
  const adminLink = document.getElementById("nav-admin") as HTMLElement | null;
  if (adminLink && state.role === "admin") {
    adminLink.hidden = false;
  }
}

// ─── DOMContentLoaded ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("app", state);

  initNavbar("dashboard");
  renderApp(false);

  const unitSelect = document.getElementById("unit-select") as HTMLSelectElement | null;

  getSettings()
    .then((settings) => {
      _preferredUnit = settings.preferredUnit;
      if (unitSelect) unitSelect.value = _preferredUnit;
      return refreshEntries();
    })
    .then(() => {
      if (hasMigratableData()) {
        showMigrationButton(async () => {
          try {
            const result = await runMigration();
            hideMigrationButton();
            showMigrationResult(result);
            await refreshEntries();
          } catch {
            showApiError("Migration failed.");
          }
        });
      }
    })
    .catch(() => {
      showApiError("Failed to load application configuration.");
    });

  unitSelect?.addEventListener("change", async () => {
    const newUnit = unitSelect.value as string;
    _preferredUnit = newUnit;
    try {
      const currentSettings = await getSettings();
      await updateSettings({ ...currentSettings, preferredUnit: newUnit as WeightUnit });
    } catch {
      // non-fatal
    }
    renderEntryList(_entries, _preferredUnit);
    void refreshChart();
  });

  const submitBtn = document.getElementById("submit-btn");
  submitBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    const input = document.getElementById("weight-input") as HTMLInputElement | null;
    const unitSel = document.getElementById("unit-select") as HTMLSelectElement | null;
    if (!input) return;

    const entryUnit = (unitSel?.value ?? _preferredUnit) as "kg" | "lbs";
    const validation = validateWeight(input.value, entryUnit);
    if (!validation.valid) {
      const errEl = document.getElementById("error-msg");
      if (errEl) errEl.textContent = validation.error ?? "Invalid entry.";
      return;
    }
    const errEl = document.getElementById("error-msg");
    if (errEl) errEl.textContent = "";

    showApiLoading();
    try {
      await apiCreateEntry({
        weightValue: Number(input.value.trim()),
        unit: entryUnit,
        timestamp: new Date().toISOString(),
      });
      input.value = "";
      await refreshEntries();
    } catch (err) {
      if (err instanceof ApiError) {
        showApiError(err.message);
      } else {
        showApiError("Failed to save entry.");
      }
    } finally {
      hideApiLoading();
    }
  });

  const weightInput = document.getElementById("weight-input");
  weightInput?.addEventListener("keydown", async (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      submitBtn?.click();
    }
  });

  const entryList = document.getElementById("entry-list");
  entryList?.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute("data-action") === "delete") {
      const id = target.getAttribute("data-id");
      if (id && window.confirm("Delete this entry?")) {
        showApiLoading();
        try {
          await apiDeleteEntry(id);
          await refreshEntries();
        } catch {
          showApiError("Failed to delete entry.");
        } finally {
          hideApiLoading();
        }
      }
    } else if (target.getAttribute("data-action") === "delete-all") {
      if (window.confirm("Delete all entries? This cannot be undone.")) {
        showApiLoading();
        try {
          await apiDeleteAllEntries();
          await refreshEntries();
        } catch {
          showApiError("Failed to delete all entries.");
        } finally {
          hideApiLoading();
        }
      }
    }
  });

  const exportBtn = document.getElementById("export-btn");
  exportBtn?.addEventListener("click", async () => {
    const formatSelect = document.getElementById("export-format") as HTMLSelectElement | null;
    const format = (formatSelect?.value ?? "csv") as "csv" | "json";

    showApiLoading();
    try {
      const { getEntries: fetchForExport } = await import("./api-client");
      const response = await fetchForExport();
      const entries = response.entries;

      if (format === "csv") {
        const content = generateCSV(entries);
        triggerDownload(content, formatExportFilename("csv"), "text/csv");
      } else {
        const content = generateJSON(entries);
        triggerDownload(content, formatExportFilename("json"), "application/json");
      }
    } catch {
      showApiError("Failed to export entries.");
    } finally {
      hideApiLoading();
    }
  });

  const settingsBtn = document.getElementById("chart-settings-btn");
  settingsBtn?.addEventListener("click", () => void openSettingsModal());

  const settingsModal = document.getElementById("chart-settings-modal") as HTMLDialogElement | null;
  const cancelBtn = document.getElementById("settings-cancel-btn");
  cancelBtn?.addEventListener("click", closeSettingsModal);
  settingsModal?.addEventListener("cancel", closeSettingsModal);

  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  const settingsForm = document.getElementById("chart-settings-form");
  settingsForm?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
    }
  });

  const saveBtn = document.getElementById("settings-save-btn");
  saveBtn?.addEventListener("click", async () => {
    const validated = validateSettingsForm();
    if (!validated) return;
    try {
      await updateSettings(validated);
      closeSettingsModal();
      await refreshEntries();
    } catch {
      showApiError("Failed to save settings.");
    }
  });
});
