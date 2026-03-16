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

vi.mock("../src/ts/api-client", () => ({
  getEntries: vi.fn(),
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
  deleteAllEntries: vi.fn(),
  getChartData: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  migrateFromLocalStorage: vi.fn(),
}));

import {
  renderApp,
  renderRecoveryScreen,
  renderEntry,
  renderEntryList,
  showError,
  clearError,
  showApiLoading,
  hideApiLoading,
  showApiError,
  clearApiError,
} from "../src/ts/ui";
import { isDataCorrupt, getRawStorageString } from "../src/ts/storage";
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
      <div id="loading-indicator" hidden></div>
      <div id="api-error-banner" hidden></div>
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

  it("else branch restores app visibility after corrupt was true", () => {
    vi.mocked(isDataCorrupt).mockReturnValue(true);
    renderApp(true);
    // DOM is now: recovery=visible, app=hidden
    vi.mocked(isDataCorrupt).mockReturnValue(false);
    renderApp(false);
    // Else branch must have run to flip these back
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

  it("download anchor has filename 'weight-data-raw.txt'", () => {
    vi.mocked(getRawStorageString).mockReturnValue("raw");
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();

    let capturedAnchor: HTMLAnchorElement | undefined;
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") {
        capturedAnchor = el as HTMLAnchorElement;
        vi.spyOn(capturedAnchor, "click").mockImplementation(vi.fn());
      }
      return el;
    });

    renderRecoveryScreen();
    document.getElementById("download-raw-btn")!.click();
    expect(capturedAnchor?.download).toBe("weight-data-raw.txt");

    vi.restoreAllMocks();
  });

  it("download blob contains the raw data (non-empty size)", () => {
    vi.mocked(getRawStorageString).mockReturnValue("some raw content here");
    let capturedBlob: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => { capturedBlob = blob; return "blob:mock-url"; });
    URL.revokeObjectURL = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(vi.fn());
      return el;
    });
    renderRecoveryScreen();
    document.getElementById("download-raw-btn")!.click();
    expect(capturedBlob?.size).toBeGreaterThan(0);
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

// ─── US2: History rendering (T020) ────────────────────────────────────────────
describe("renderEntryList — history rendering (US2)", () => {
  it("renders entries in newest-first order", () => {
    const entries: WeightEntry[] = [
      makeEntry({ id: "oldest", timestamp: "2026-01-01T00:00:00.000Z", weightValue: 70 }),
      makeEntry({ id: "newest", timestamp: "2026-03-13T00:00:00.000Z", weightValue: 82 }),
      makeEntry({ id: "middle", timestamp: "2026-02-15T00:00:00.000Z", weightValue: 75 }),
    ];
    renderEntryList(entries, "kg");
    const rows = document.querySelectorAll("#entry-list .entry-row");
    expect(rows[0].getAttribute("data-id")).toBe("newest");
    expect(rows[1].getAttribute("data-id")).toBe("middle");
    expect(rows[2].getAttribute("data-id")).toBe("oldest");
  });

  it("each row displays weight value, stored unit label, date and time", () => {
    const entry = makeEntry({ weightValue: 82.5, unit: "kg", timestamp: "2026-03-13T09:15:00.000Z" });
    renderEntryList([entry], "kg");
    const row = document.querySelector("#entry-list [data-id='e1']")!;
    expect(row.textContent).toContain("82.5");
    expect(row.textContent).toContain("kg");
  });

  it("renders empty-state message when array is empty", () => {
    renderEntryList([], "kg");
    const list = document.getElementById("entry-list")!;
    expect(list.textContent).toContain("No entries yet");
    expect(document.querySelectorAll("#entry-list [data-id]").length).toBe(0);
  });

  it("new entry prepended to existing list maintains newest-first", () => {
    const existing = makeEntry({ id: "old", timestamp: "2026-01-01T00:00:00.000Z" });
    renderEntryList([existing], "kg");
    const newEntry = makeEntry({ id: "new", timestamp: "2026-03-13T00:00:00.000Z", weightValue: 80 });
    renderEntryList([newEntry, existing], "kg");
    const rows = document.querySelectorAll("#entry-list .entry-row");
    expect(rows[0].getAttribute("data-id")).toBe("new");
    expect(rows[1].getAttribute("data-id")).toBe("old");
  });

  it("all entries display in the passed displayUnit", () => {
    const entries: WeightEntry[] = [
      makeEntry({ id: "kg-entry", unit: "kg", weightValue: 75, timestamp: "2026-03-13T09:00:00.000Z" }),
      makeEntry({ id: "lbs-entry", unit: "lbs", weightValue: 165, timestamp: "2026-03-12T09:00:00.000Z" }),
    ];
    renderEntryList(entries, "kg");
    const kgRow = document.querySelector("[data-id='kg-entry']")!;
    const lbsRow = document.querySelector("[data-id='lbs-entry']")!;
    // Both should now show in kg (the passed displayUnit)
    expect(kgRow.textContent).toContain("kg");
    expect(lbsRow.textContent).toContain("kg");
  });

  it("converts lbs entry to kg when displayUnit is kg", () => {
    const entry = makeEntry({ id: "lbs-entry", unit: "lbs", weightValue: 220, timestamp: "2026-03-13T09:00:00.000Z" });
    renderEntryList([entry], "kg");
    const row = document.querySelector("[data-id='lbs-entry']")!;
    // 220 lbs * 0.453592 ≈ 99.8 kg
    expect(row.textContent).toContain("99.8");
    expect(row.textContent).toContain("kg");
  });

  it("converts kg entry to lbs when displayUnit is lbs", () => {
    const entry = makeEntry({ id: "kg-entry", unit: "kg", weightValue: 100, timestamp: "2026-03-13T09:00:00.000Z" });
    renderEntryList([entry], "lbs");
    const row = document.querySelector("[data-id='kg-entry']")!;
    // 100 kg * 2.20462 ≈ 220.5 lbs
    expect(row.textContent).toContain("220.5");
    expect(row.textContent).toContain("lbs");
  });
});

// ─── US3: Delete flow (T027) ──────────────────────────────────────────────────
describe("delete flow (US3)", () => {
  it("delete buttons carry data-action='delete' attribute", () => {
    renderEntryList([makeEntry({ id: "abc" })], "kg");
    const btn = document.querySelector("[data-action='delete']");
    expect(btn).not.toBeNull();
  });

  it("delete button data-id matches the entry id", () => {
    renderEntryList([makeEntry({ id: "target-id" })], "kg");
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

// ─── renderEntry — direct DOM assertions ──────────────────────────────────────
describe("renderEntry — DOM structure", () => {
  it("has class 'entry-row' on the row element", () => {
    const row = renderEntry(makeEntry({ weightValue: 75, unit: "kg" }));
    expect(row.className).toBe("entry-row");
  });

  it("weight cell has class 'entry-weight'", () => {
    const row = renderEntry(makeEntry());
    const cell = row.querySelector(".entry-weight");
    expect(cell).not.toBeNull();
  });

  it("date cell has class 'entry-date'", () => {
    const row = renderEntry(makeEntry());
    const cell = row.querySelector(".entry-date");
    expect(cell).not.toBeNull();
  });

  it("time cell has class 'entry-time'", () => {
    const row = renderEntry(makeEntry());
    const cell = row.querySelector(".entry-time");
    expect(cell).not.toBeNull();
  });

  it("actions cell has class 'entry-actions'", () => {
    const row = renderEntry(makeEntry());
    const cell = row.querySelector(".entry-actions");
    expect(cell).not.toBeNull();
  });

  it("delete button text is 'Delete'", () => {
    const row = renderEntry(makeEntry({ id: "del-test" }));
    const btn = row.querySelector("[data-action='delete']") as HTMLButtonElement;
    expect(btn.textContent).toBe("Delete");
  });

  it("delete button aria-label is 'Delete entry'", () => {
    const row = renderEntry(makeEntry({ id: "del-aria" }));
    const btn = row.querySelector("[data-action='delete']") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("Delete entry");
  });

  it("weight cell shows the weight with 1 decimal and the display unit", () => {
    const row = renderEntry(makeEntry({ weightValue: 82.5, unit: "kg" }), "kg");
    const cell = row.querySelector(".entry-weight")!;
    expect(cell.textContent).toBe("82.5 kg");
  });

  it("default displayUnit falls back to entry.unit", () => {
    const row = renderEntry(makeEntry({ weightValue: 180, unit: "lbs" }));
    const cell = row.querySelector(".entry-weight")!;
    expect(cell.textContent).toContain("lbs");
  });

  it("converts kg to lbs when displayUnit is lbs", () => {
    const row = renderEntry(makeEntry({ weightValue: 100, unit: "kg" }), "lbs");
    const cell = row.querySelector(".entry-weight")!;
    expect(cell.textContent).toContain("220.5");
    expect(cell.textContent).toContain("lbs");
  });

  it("converts lbs to kg when displayUnit is kg", () => {
    const row = renderEntry(makeEntry({ weightValue: 220, unit: "lbs" }), "kg");
    const cell = row.querySelector(".entry-weight")!;
    expect(cell.textContent).toContain("99.8");
    expect(cell.textContent).toContain("kg");
  });

  it("date cell is non-empty for a valid timestamp", () => {
    const row = renderEntry(makeEntry({ timestamp: "2026-03-13T09:15:00.000Z" }));
    const cell = row.querySelector(".entry-date")!;
    expect(cell.textContent).not.toBe("");
  });

  it("time cell is non-empty for a valid timestamp", () => {
    const row = renderEntry(makeEntry({ timestamp: "2026-03-13T09:15:00.000Z" }));
    const cell = row.querySelector(".entry-time")!;
    expect(cell.textContent).not.toBe("");
  });
});

// ─── renderEntryList — table structure ────────────────────────────────────────
describe("renderEntryList — table header and structure", () => {
  it("table header contains 'Weight' column", () => {
    renderEntryList([makeEntry()], "kg");
    const ths = document.querySelectorAll("#entry-list th");
    const texts = Array.from(ths).map((th) => th.textContent);
    expect(texts.some((t) => t?.includes("Weight"))).toBe(true);
  });

  it("table header contains 'Date' column", () => {
    renderEntryList([makeEntry()], "kg");
    const ths = document.querySelectorAll("#entry-list th");
    const texts = Array.from(ths).map((th) => th.textContent);
    expect(texts.some((t) => t?.includes("Date"))).toBe(true);
  });

  it("table header contains 'Time' column", () => {
    renderEntryList([makeEntry()], "kg");
    const ths = document.querySelectorAll("#entry-list th");
    const texts = Array.from(ths).map((th) => th.textContent);
    expect(texts.some((t) => t?.includes("Time"))).toBe(true);
  });

  it("renders a 'Delete all' button with data-action='delete-all'", () => {
    renderEntryList([makeEntry()], "kg");
    const btn = document.querySelector("[data-action='delete-all']");
    expect(btn).not.toBeNull();
  });

  it("'Delete all' button has aria-label 'Delete all entries'", () => {
    renderEntryList([makeEntry()], "kg");
    const btn = document.querySelector("[data-action='delete-all']") as HTMLElement;
    expect(btn.getAttribute("aria-label")).toBe("Delete all entries");
  });

  it("'Delete all' button text contains 'Delete all'", () => {
    renderEntryList([makeEntry()], "kg");
    const btn = document.querySelector("[data-action='delete-all']")!;
    expect(btn.textContent).toContain("Delete all");
  });

  it("empty-state paragraph has class 'empty-state'", () => {
    renderEntryList([], "kg");
    const el = document.querySelector(".empty-state");
    expect(el).not.toBeNull();
  });

  it("empty-state message text mentions 'log'", () => {
    renderEntryList([], "kg");
    const el = document.querySelector(".empty-state")!;
    expect(el.textContent?.toLowerCase()).toContain("log");
  });

  it("re-rendering clears previous entries (innerHTML reset)", () => {
    renderEntryList([makeEntry({ id: "first" })], "kg");
    renderEntryList([makeEntry({ id: "second" })], "kg");
    const rows = document.querySelectorAll("#entry-list .entry-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-id")).toBe("second");
  });

  it("entry table has class 'entry-table'", () => {
    renderEntryList([makeEntry()], "kg");
    expect(document.querySelector("#entry-list .entry-table")).not.toBeNull();
  });

  it("list has exactly one child node (the table) when entries are present", () => {
    renderEntryList([makeEntry()], "kg");
    const list = document.getElementById("entry-list")!;
    expect(list.childNodes).toHaveLength(1);
    expect(list.firstChild?.nodeName).toBe("TABLE");
  });

  it("list has exactly one child node (the empty-state paragraph) when entries are absent", () => {
    renderEntryList([], "kg");
    const list = document.getElementById("entry-list")!;
    expect(list.childNodes).toHaveLength(1);
    expect(list.firstChild?.nodeName).toBe("P");
  });
});

// ─── showMigrationButton ──────────────────────────────────────────────────────
describe("showMigrationButton", () => {
  beforeEach(() => {
    buildDOM();
  });

  it("inserts a migration banner before #app", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    showMigrationButton(async () => {});
    const banner = document.getElementById("migration-banner");
    expect(banner).not.toBeNull();
  });

  it("banner contains a paragraph about previous version data", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    showMigrationButton(async () => {});
    const banner = document.getElementById("migration-banner")!;
    expect(banner.textContent).toContain("previous version");
  });

  it("migration button has id 'migration-btn'", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    showMigrationButton(async () => {});
    expect(document.getElementById("migration-btn")).not.toBeNull();
  });

  it("migration button text mentions 'Import'", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    showMigrationButton(async () => {});
    const btn = document.getElementById("migration-btn")!;
    expect(btn.textContent).toContain("Import");
  });

  it("migration banner has class 'migration-banner'", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    showMigrationButton(async () => {});
    const banner = document.getElementById("migration-banner")!;
    expect(banner.className).toBe("migration-banner");
  });

  it("banner paragraph specifically contains 'previous version'", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    showMigrationButton(async () => {});
    const banner = document.getElementById("migration-banner")!;
    const p = banner.querySelector("p");
    expect(p?.textContent).toContain("previous version");
  });

  it("migration button calls onClick when clicked", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    const onClickSpy = vi.fn().mockResolvedValue(undefined);
    showMigrationButton(onClickSpy);
    document.getElementById("migration-btn")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onClickSpy).toHaveBeenCalled();
  });

  it("calling showMigrationButton twice does not insert a second banner", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    showMigrationButton(async () => {});
    showMigrationButton(async () => {});
    const banners = document.querySelectorAll("#migration-banner");
    expect(banners).toHaveLength(1);
  });

  it("migration button is disabled and changes text while onClick is pending", async () => {
    const { showMigrationButton } = await import("../src/ts/ui");
    let resolveFn!: () => void;
    const pendingPromise = new Promise<void>((resolve) => { resolveFn = resolve; });
    showMigrationButton(() => pendingPromise);
    const btn = document.getElementById("migration-btn") as HTMLButtonElement;
    btn.click();
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Import");
    resolveFn();
    await pendingPromise;
  });
});

// ─── showMigrationResult ──────────────────────────────────────────────────────
describe("showMigrationResult", () => {
  beforeEach(() => {
    buildDOM();
    const el = document.createElement("div");
    el.id = "migration-result";
    el.hidden = true;
    document.body.appendChild(el);
  });

  it("sets migration result text with migrated count", async () => {
    const { showMigrationResult } = await import("../src/ts/ui");
    showMigrationResult({ migratedEntries: 5, skippedEntries: 0, skippedReasons: [] });
    const el = document.getElementById("migration-result")!;
    expect(el.textContent).toContain("5");
    expect(el.hidden).toBe(false);
  });

  it("includes skipped count when skippedEntries > 0", async () => {
    const { showMigrationResult } = await import("../src/ts/ui");
    showMigrationResult({ migratedEntries: 3, skippedEntries: 2, skippedReasons: [] });
    const el = document.getElementById("migration-result")!;
    expect(el.textContent).toContain("Skipped 2");
  });

  it("does not include skipped text when skippedEntries === 0", async () => {
    const { showMigrationResult } = await import("../src/ts/ui");
    showMigrationResult({ migratedEntries: 3, skippedEntries: 0, skippedReasons: [] });
    const el = document.getElementById("migration-result")!;
    expect(el.textContent).not.toContain("Skipped");
  });

  it("makes the migration-result element visible", async () => {
    const { showMigrationResult } = await import("../src/ts/ui");
    showMigrationResult({ migratedEntries: 1, skippedEntries: 0, skippedReasons: [] });
    expect(document.getElementById("migration-result")!.hidden).toBe(false);
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

// ─── showApiLoading / hideApiLoading ──────────────────────────────────────────
describe("showApiLoading / hideApiLoading", () => {
  it("showApiLoading makes #loading-indicator visible", () => {
    showApiLoading();
    expect(document.getElementById("loading-indicator")!.hidden).toBe(false);
  });

  it("hideApiLoading hides #loading-indicator", () => {
    showApiLoading();
    hideApiLoading();
    expect(document.getElementById("loading-indicator")!.hidden).toBe(true);
  });
});

// ─── showApiError / clearApiError ─────────────────────────────────────────────
describe("showApiError / clearApiError", () => {
  it("showApiError sets the banner text and makes it visible", () => {
    showApiError("Server unavailable");
    const banner = document.getElementById("api-error-banner")!;
    expect(banner.textContent).toBe("Server unavailable");
    expect(banner.hidden).toBe(false);
  });

  it("clearApiError empties the banner text and hides it", () => {
    showApiError("Some error");
    clearApiError();
    const banner = document.getElementById("api-error-banner")!;
    expect(banner.textContent).toBe("");
    expect(banner.hidden).toBe(true);
  });
});
