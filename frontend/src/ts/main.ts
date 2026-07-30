import { loadConfig, getApiUrl } from "./config";
import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import { clearAccessToken, getUserId } from "./auth-token";
import { clearAuthMarker, getAuthMarker, getPendingOps } from "./offline-store";
import { loadEntries, addEntry, removeEntry, removeAllEntries, loadSettings } from "./entry-store";
import { runSync, initSync } from "./sync";
import { initNavbar } from "./navbar";
import { initTheme } from "./theme";
import { computeChartData } from "./chart-calculations";
import { getSettings, updateSettings, ApiError } from "./api-client";
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
import type { WeightUnit, WeightEntry, ChartSettings } from "./model";
import type { Chart } from "chart.js";

let _chartInstance: Chart | null = null;
let _entries: WeightEntry[] = [];
let _preferredUnit: string = "kg";
let _settings: ChartSettings | null = null;
let _userId: string | null = null;

/**
 * The user's id, whichever source survives the current situation: the
 * in-memory access token (online) or the persisted auth marker (offline
 * reload, where the in-memory token is gone).
 */
function currentUserId(): string | null {
  return _userId ?? getUserId() ?? getAuthMarker()?.userId ?? null;
}

function refreshChart(): void {
  try {
    if (!_settings) {
      hideChartSection();
      return;
    }
    // Computed client-side so the chart is identical online and offline.
    const dataset = computeChartData(_entries, _settings, _preferredUnit as WeightUnit);

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
  const userId = currentUserId();
  if (!userId) return;
  showApiLoading();
  clearApiError();
  try {
    const { entries } = await loadEntries(userId);
    _entries = entries;
    renderEntryList(_entries, _preferredUnit);
    refreshChart();
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

  const settings = _settings ?? (await getSettings());
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
      clearAuthMarker();
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

// ─── Dashboard bootstrap ──────────────────────────────────────────────────────

export async function initDashboard(): Promise<void> {
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("app", state);

  initNavbar("dashboard");
  renderApp(false);

  _userId = getUserId() ?? getAuthMarker()?.userId ?? null;
  const unitSelect = document.getElementById("unit-select") as HTMLSelectElement | null;

  const bootstrap = (async () => {
    const userId = currentUserId();
    if (!userId) return;

    _settings = await loadSettings(userId);
    _preferredUnit = _settings.preferredUnit;
    if (unitSelect) unitSelect.value = _preferredUnit;
    await refreshEntries();

    // Automatic sync: re-run whenever connectivity returns…
    initSync({ getUserId: currentUserId, onAfterSync: refreshEntries });
    // …and once now, if an earlier offline session left work queued.
    if (!state.offline && getPendingOps(userId).length > 0) {
      void runSync(userId).then((synced) => {
        if (synced) return refreshEntries();
      });
    }

    // The legacy localStorage migration probe needs the server.
    if (!state.offline && hasMigratableData()) {
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
  })();
  bootstrap.catch(() => {
    showApiError("Failed to load application configuration.");
  });
  await bootstrap.catch(() => undefined);

  unitSelect?.addEventListener("change", async () => {
    const newUnit = unitSelect.value as string;
    _preferredUnit = newUnit;
    if (_settings) _settings = { ..._settings, preferredUnit: newUnit };
    try {
      await updateSettings({ ...(_settings ?? {}), preferredUnit: newUnit as WeightUnit });
    } catch {
      // non-fatal — offline unit preference applies locally until next sync
    }
    renderEntryList(_entries, _preferredUnit);
    refreshChart();
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

    const userId = currentUserId();
    if (!userId) return;
    showApiLoading();
    try {
      // entry-store applies the write locally at once and queues it when offline.
      await addEntry(userId, {
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
    const userId = currentUserId();
    if (!userId) return;
    if (target.getAttribute("data-action") === "delete") {
      const id = target.getAttribute("data-id");
      if (id && window.confirm("Delete this entry?")) {
        showApiLoading();
        try {
          await removeEntry(userId, id);
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
          await removeAllEntries(userId);
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
  exportBtn?.addEventListener("click", () => {
    const formatSelect = document.getElementById("export-format") as HTMLSelectElement | null;
    const format = (formatSelect?.value ?? "csv") as "csv" | "json";

    // Export the local state — no server round-trip, so it works offline.
    try {
      if (format === "csv") {
        const content = generateCSV(_entries);
        triggerDownload(content, formatExportFilename("csv"), "text/csv");
      } else {
        const content = generateJSON(_entries);
        triggerDownload(content, formatExportFilename("json"), "application/json");
      }
    } catch {
      showApiError("Failed to export entries.");
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
      _settings = await updateSettings(validated);
      closeSettingsModal();
      await refreshEntries();
    } catch {
      showApiError("Failed to save settings.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => void initDashboard());
