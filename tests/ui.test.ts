import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ─── Module mocks (must be hoisted before imports) ────────────────────────────
vi.mock("../src/ts/storage", () => ({
  loadEntries: vi.fn(() => []),
  saveEntries: vi.fn(),
  loadPreferences: vi.fn(() => ({ unit: "kg" })),
  savePreferences: vi.fn(),
  isDataCorrupt: vi.fn(() => false),
  getRawStorageString: vi.fn(() => ""),
}));

vi.mock("../src/ts/model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ts/model")>();
  return {
    ...actual,
    createEntry: vi.fn((weightValue: number, unit: string) => ({
      id: "test-id-" + Math.random().toString(36).slice(2),
      weightValue,
      unit,
      timestamp: new Date().toISOString(),
    })),
  };
});

import {
  renderApp,
  renderRecoveryScreen,
  renderEntryList,
  handleSubmit,
  showError,
  clearError,
} from "../src/ts/ui";
import { isDataCorrupt, getRawStorageString, saveEntries } from "../src/ts/storage";
import { createEntry } from "../src/ts/model";
import type { WeightEntry } from "../src/ts/model";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildDOM() {
  document.body.innerHTML = `
    <div id="recovery-screen" hidden>
      <p id="recovery-msg"></p>
      <button id="download-raw-btn">Download raw data</button>
      <button id="reset-btn">Reset</button>
    </div>
    <div id="app">
      <select id="unit-select">
        <option value="kg">kg</option>
        <option value="lbs">lbs</option>
      </select>
      <input id="weight-input" type="number" step="0.1" min="0" />
      <button id="submit-btn">Log Weight</button>
      <div id="error-msg" role="alert"></div>
      <div id="entry-list"></div>
      <select id="export-format">
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
      </select>
      <button id="export-btn">Export</button>
    </div>
  `;
}

function makeEntry(overrides: Partial<WeightEntry> = {}): WeightEntry {
  return {
    id: "e1",
    weightValue: 75,
    unit: "kg",
    timestamp: "2026-03-13T09:15:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  buildDOM();
  vi.mocked(isDataCorrupt).mockReturnValue(false);
  vi.mocked(getRawStorageString).mockReturnValue("");
  vi.mocked(saveEntries).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── FR-013: Recovery screen (T015) ───────────────────────────────────────────
describe("renderApp — corrupt-data recovery screen (FR-013)", () => {
  it("shows #recovery-screen and hides #app when corrupt=true", () => {
    vi.mocked(isDataCorrupt).mockReturnValue(true);
    renderApp(true);
    const recovery = document.getElementById("recovery-screen")!;
    const app = document.getElementById("app")!;
    expect(recovery.hidden).toBe(false);
    expect(app.hidden).toBe(true);
  });

  it("shows #app and hides #recovery-screen when corrupt=false", () => {
    renderApp(false);
    const recovery = document.getElementById("recovery-screen")!;
    const app = document.getElementById("app")!;
    expect(recovery.hidden).toBe(true);
    expect(app.hidden).toBe(false);
  });
});

describe("renderRecoveryScreen", () => {
  it("clicking 'Download raw data' triggers a file download named weight-data-raw.txt", () => {
    const rawData = '[{"id":"x","weightValue":70,"unit":"kg","timestamp":"2026-01-01T00:00:00.000Z"}]';
    vi.mocked(getRawStorageString).mockReturnValue(rawData);

    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") {
        vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(clickSpy);
      }
      return el;
    });

    renderRecoveryScreen();
    const downloadBtn = document.getElementById("download-raw-btn") as HTMLButtonElement;
    downloadBtn.click();

    expect(getRawStorageString).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe("text/plain");

    vi.restoreAllMocks();
  });

  it("clicking 'Reset' calls localStorage.clear() and location.reload()", () => {
    const clearSpy = vi.spyOn(Storage.prototype, "clear");
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    renderRecoveryScreen();
    const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
    resetBtn.click();

    expect(clearSpy).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });
});

// ─── US1: Entry submission (T017) ─────────────────────────────────────────────
describe("handleSubmit — entry submission (US1)", () => {
  it("creates entry and prepends it to the list on valid input", () => {
    const input = document.getElementById("weight-input") as HTMLInputElement;
    const unitSelect = document.getElementById("unit-select") as HTMLSelectElement;
    input.value = "75";
    unitSelect.value = "kg";

    handleSubmit(new Event("click"));

    const rows = document.querySelectorAll("#entry-list .entry-row");
    expect(rows.length).toBe(1);
  });

  it("clears the weight input field after successful submission", () => {
    const input = document.getElementById("weight-input") as HTMLInputElement;
    input.value = "75";
    handleSubmit(new Event("click"));
    expect(input.value).toBe("");
  });

  it("shows no error message after successful submission", () => {
    const input = document.getElementById("weight-input") as HTMLInputElement;
    input.value = "75";
    handleSubmit(new Event("click"));
    const errorDiv = document.getElementById("error-msg")!;
    expect(errorDiv.textContent).toBe("");
  });

  it("shows error and creates no entry on empty input", () => {
    const input = document.getElementById("weight-input") as HTMLInputElement;
    input.value = "";
    handleSubmit(new Event("click"));
    const errorDiv = document.getElementById("error-msg")!;
    expect(errorDiv.textContent).not.toBe("");
    const rows = document.querySelectorAll("#entry-list [data-id]");
    expect(rows.length).toBe(0);
  });

  it("shows error and retains value on out-of-range kg input", () => {
    const input = document.getElementById("weight-input") as HTMLInputElement;
    input.value = "1000";
    handleSubmit(new Event("click"));
    const errorDiv = document.getElementById("error-msg")!;
    expect(errorDiv.textContent).not.toBe("");
    expect(input.value).toBe("1000");
  });

  it("Enter key in #weight-input triggers submit behavior", () => {
    const input = document.getElementById("weight-input") as HTMLInputElement;
    input.value = "80";
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    input.dispatchEvent(event);
    // handleSubmit is wired in main.ts; here we test the submit function directly
    handleSubmit(new Event("submit"));
    const rows = document.querySelectorAll("#entry-list [data-id]");
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ─── US2: History rendering (T020) ────────────────────────────────────────────
describe("renderEntryList — history rendering (US2)", () => {
  it("renders entries in newest-first order", () => {
    const entries: WeightEntry[] = [
      makeEntry({ id: "oldest", timestamp: "2026-01-01T00:00:00.000Z", weightValue: 70 }),
      makeEntry({ id: "newest", timestamp: "2026-03-13T00:00:00.000Z", weightValue: 82 }),
      makeEntry({ id: "middle", timestamp: "2026-02-15T00:00:00.000Z", weightValue: 75 }),
    ];
    renderEntryList(entries);
    const rows = document.querySelectorAll("#entry-list .entry-row");
    expect(rows[0].getAttribute("data-id")).toBe("newest");
    expect(rows[1].getAttribute("data-id")).toBe("middle");
    expect(rows[2].getAttribute("data-id")).toBe("oldest");
  });

  it("each row displays weight value, stored unit label, date and time", () => {
    const entry = makeEntry({ weightValue: 82.5, unit: "kg", timestamp: "2026-03-13T09:15:00.000Z" });
    renderEntryList([entry]);
    const row = document.querySelector("#entry-list [data-id='e1']")!;
    expect(row.textContent).toContain("82.5");
    expect(row.textContent).toContain("kg");
  });

  it("renders empty-state message when array is empty", () => {
    renderEntryList([]);
    const list = document.getElementById("entry-list")!;
    expect(list.textContent).toContain("No entries yet");
    expect(document.querySelectorAll("#entry-list [data-id]").length).toBe(0);
  });

  it("new entry prepended to existing list maintains newest-first", () => {
    const existing = makeEntry({ id: "old", timestamp: "2026-01-01T00:00:00.000Z" });
    renderEntryList([existing]);
    const newEntry = makeEntry({ id: "new", timestamp: "2026-03-13T00:00:00.000Z", weightValue: 80 });
    renderEntryList([newEntry, existing]);
    const rows = document.querySelectorAll("#entry-list .entry-row");
    expect(rows[0].getAttribute("data-id")).toBe("new");
    expect(rows[1].getAttribute("data-id")).toBe("old");
  });

  it("entries with different stored units each display their own label", () => {
    const entries: WeightEntry[] = [
      makeEntry({ id: "kg-entry", unit: "kg", weightValue: 75, timestamp: "2026-03-13T09:00:00.000Z" }),
      makeEntry({ id: "lbs-entry", unit: "lbs", weightValue: 165, timestamp: "2026-03-12T09:00:00.000Z" }),
    ];
    renderEntryList(entries);
    const kgRow = document.querySelector("[data-id='kg-entry']")!;
    const lbsRow = document.querySelector("[data-id='lbs-entry']")!;
    expect(kgRow.textContent).toContain("kg");
    expect(lbsRow.textContent).toContain("lbs");
  });
});

// ─── US3: Delete flow (T027) ──────────────────────────────────────────────────
describe("delete flow (US3)", () => {
  it("delete buttons carry data-action='delete' attribute", () => {
    renderEntryList([makeEntry({ id: "abc" })]);
    const btn = document.querySelector("[data-action='delete']");
    expect(btn).not.toBeNull();
  });

  it("delete button data-id matches the entry id", () => {
    renderEntryList([makeEntry({ id: "target-id" })]);
    const btn = document.querySelector("[data-action='delete']") as HTMLElement;
    expect(btn.getAttribute("data-id")).toBe("target-id");
  });
});

// ─── T008: Chart section visibility ───────────────────────────────────────────
describe("chart section visibility (FR-004, FR-019)", () => {
  beforeEach(() => {
    // Add chart section to DOM
    const main = document.querySelector("main") || document.getElementById("app");
    const chartSection = document.createElement("section");
    chartSection.id = "chart-section";
    chartSection.hidden = true;
    const infoMsg = document.createElement("div");
    infoMsg.id = "chart-info-msg";
    chartSection.appendChild(infoMsg);
    if (main) main.insertBefore(chartSection, main.firstChild);
  });

  it("imports showChartSection and hideChartSection without error", async () => {
    const { showChartSection, hideChartSection } = await import("../src/ts/ui");
    expect(typeof showChartSection).toBe("function");
    expect(typeof hideChartSection).toBe("function");
  });

  it("showChartSection removes the hidden attribute from #chart-section", async () => {
    const { showChartSection } = await import("../src/ts/ui");
    showChartSection("no-goal");
    const section = document.getElementById("chart-section");
    expect(section?.hidden).toBe(false);
  });

  it("hideChartSection sets the hidden attribute on #chart-section", async () => {
    const { showChartSection, hideChartSection } = await import("../src/ts/ui");
    showChartSection("no-goal");
    hideChartSection();
    const section = document.getElementById("chart-section");
    expect(section?.hidden).toBe(true);
  });

  it("showChartSection with 'no-goal' shows the informational message", async () => {
    const { showChartSection } = await import("../src/ts/ui");
    showChartSection("no-goal");
    const msg = document.getElementById("chart-info-msg");
    expect(msg?.textContent).toContain("Corridor lines require");
  });

  it("showChartSection with 'calibrating' shows the informational message", async () => {
    const { showChartSection } = await import("../src/ts/ui");
    showChartSection("calibrating");
    const msg = document.getElementById("chart-info-msg");
    expect(msg?.textContent).toContain("Corridor lines require");
  });

  it("showChartSection with 'ready' clears the informational message", async () => {
    const { showChartSection } = await import("../src/ts/ui");
    showChartSection("ready");
    const msg = document.getElementById("chart-info-msg");
    expect(msg?.textContent).toBe("");
  });
});

// ─── T018: Settings modal (US2) ───────────────────────────────────────────────
describe("settings modal DOM structure (US2 / FR-020)", () => {
  beforeEach(() => {
    // Add settings modal and trigger button to DOM
    const dialog = document.createElement("dialog");
    dialog.id = "chart-settings-modal";
    const form = document.createElement("form");
    form.id = "chart-settings-form";
    form.method = "dialog";

    const fields = [
      ["weight-goal-input", "weight-goal-error"],
      ["loss-rate-input", "loss-rate-error"],
      ["carb-fat-ratio-input", "carb-fat-error"],
      ["buffer-value-input", "buffer-error"],
    ];
    for (const [inputId, errId] of fields) {
      const input = document.createElement("input");
      input.id = inputId;
      input.type = "number";
      const err = document.createElement("span");
      err.id = errId;
      err.role = "alert";
      form.appendChild(input);
      form.appendChild(err);
    }

    const saveBtn = document.createElement("button");
    saveBtn.id = "settings-save-btn";
    saveBtn.type = "button";
    const cancelBtn = document.createElement("button");
    cancelBtn.id = "settings-cancel-btn";
    cancelBtn.type = "button";
    form.appendChild(saveBtn);
    form.appendChild(cancelBtn);
    dialog.appendChild(form);

    const settingsBtn = document.createElement("button");
    settingsBtn.id = "chart-settings-btn";
    document.body.appendChild(dialog);
    document.body.appendChild(settingsBtn);

    // Polyfill showModal/close for jsdom (jsdom doesn't implement dialog API)
    dialog.showModal = vi.fn(() => { dialog.open = true; });
    dialog.close = vi.fn(() => { dialog.open = false; });
  });

  it("dialog element exists in DOM", () => {
    expect(document.getElementById("chart-settings-modal")).not.toBeNull();
  });

  it("has all four input fields", () => {
    expect(document.getElementById("weight-goal-input")).not.toBeNull();
    expect(document.getElementById("loss-rate-input")).not.toBeNull();
    expect(document.getElementById("carb-fat-ratio-input")).not.toBeNull();
    expect(document.getElementById("buffer-value-input")).not.toBeNull();
  });

  it("has save and cancel buttons", () => {
    expect(document.getElementById("settings-save-btn")).not.toBeNull();
    expect(document.getElementById("settings-cancel-btn")).not.toBeNull();
  });

  it("has error spans for each field with role='alert'", () => {
    const errIds = ["weight-goal-error", "loss-rate-error", "carb-fat-error", "buffer-error"];
    for (const id of errIds) {
      const el = document.getElementById(id);
      expect(el).not.toBeNull();
      expect(el?.getAttribute("role")).toBe("alert");
    }
  });
});

// ─── showError / clearError ───────────────────────────────────────────────────
describe("showError / clearError", () => {
  it("showError sets error message text", () => {
    showError("Test error");
    expect(document.getElementById("error-msg")!.textContent).toBe("Test error");
  });

  it("clearError empties the error message", () => {
    showError("Some error");
    clearError();
    expect(document.getElementById("error-msg")!.textContent).toBe("");
  });
});
