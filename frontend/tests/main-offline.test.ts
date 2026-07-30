import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthStatus: vi.fn(),
  enforceRedirect: vi.fn(),
  loadEntries: vi.fn(),
  addEntry: vi.fn(),
  removeEntry: vi.fn(),
  removeAllEntries: vi.fn(),
  loadSettings: vi.fn(),
  runSync: vi.fn(),
  initSync: vi.fn(),
  renderChart: vi.fn(),
  renderEntryList: vi.fn(),
  generateCSV: vi.fn().mockReturnValue("csv"),
  generateJSON: vi.fn().mockReturnValue("{}"),
  triggerDownload: vi.fn(),
  apiGetEntries: vi.fn(),
  hasMigratableData: vi.fn().mockReturnValue(false),
}));

vi.mock("../src/ts/auth-guard", () => ({
  checkAuthStatus: mocks.checkAuthStatus,
  enforceRedirect: mocks.enforceRedirect,
}));
vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
  clearAccessToken: vi.fn(),
  getUserRole: vi.fn().mockReturnValue("user"),
  getUserId: vi.fn().mockReturnValue(null), // offline reload: in-memory token is gone
}));
vi.mock("../src/ts/config", () => ({
  loadConfig: vi.fn().mockResolvedValue(undefined),
  getApiUrl: vi.fn().mockReturnValue(""),
}));
vi.mock("../src/ts/entry-store", () => ({
  loadEntries: mocks.loadEntries,
  addEntry: mocks.addEntry,
  removeEntry: mocks.removeEntry,
  removeAllEntries: mocks.removeAllEntries,
  loadSettings: mocks.loadSettings,
}));
vi.mock("../src/ts/sync", () => ({
  runSync: mocks.runSync,
  initSync: mocks.initSync,
}));
vi.mock("../src/ts/chart", () => ({ renderChart: mocks.renderChart }));
vi.mock("../src/ts/export", () => ({
  generateCSV: mocks.generateCSV,
  generateJSON: mocks.generateJSON,
  formatExportFilename: vi.fn().mockReturnValue("f.csv"),
  triggerDownload: mocks.triggerDownload,
}));
vi.mock("../src/ts/ui", () => ({
  renderApp: vi.fn(),
  renderEntryList: mocks.renderEntryList,
  showChartSection: vi.fn(),
  hideChartSection: vi.fn(),
  showApiLoading: vi.fn(),
  hideApiLoading: vi.fn(),
  showApiError: vi.fn(),
  clearApiError: vi.fn(),
  showMigrationButton: vi.fn(),
  hideMigrationButton: vi.fn(),
  showMigrationResult: vi.fn(),
}));
vi.mock("../src/ts/navbar", () => ({ initNavbar: vi.fn() }));
vi.mock("../src/ts/theme", () => ({ initTheme: vi.fn() }));
vi.mock("../src/ts/migration-tool", () => ({
  hasMigratableData: mocks.hasMigratableData,
  runMigration: vi.fn(),
}));
vi.mock("../src/ts/api-client", () => ({
  getEntries: mocks.apiGetEntries,
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(m: string, s: number) {
      super(m);
      this.status = s;
    }
  },
}));

import { initDashboard } from "../src/ts/main";
import { saveAuthMarker, setPendingOps } from "../src/ts/offline-store";
import type { WeightEntry } from "../src/ts/model";

const USER = "11111111-1111-1111-1111-111111111111";

const SETTINGS = {
  preferredUnit: "kg",
  weightGoal: null,
  lossRate: 0.0055,
  carbFatRatio: 0.6,
  bufferValue: 0.0075,
};

function entry(id: string, weight = 80): WeightEntry {
  return { id, weightValue: weight, unit: "kg", timestamp: "2026-07-30T08:00:00.000Z" };
}

function dashboardDom(): void {
  document.body.innerHTML = `
    <div id="app" hidden>
      <section id="chart-section" hidden><canvas id="chart-canvas"></canvas></section>
      <select id="unit-select"><option value="kg">kg</option><option value="lbs">lbs</option></select>
      <input id="weight-input" />
      <button id="submit-btn"></button>
      <div id="error-msg"></div>
      <div id="entry-list"></div>
      <select id="export-format"><option value="csv">csv</option><option value="json">json</option></select>
      <button id="export-btn"></button>
    </div>
  `;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.hasMigratableData.mockReturnValue(false);
  mocks.loadSettings.mockResolvedValue(SETTINGS);
  mocks.loadEntries.mockResolvedValue({ entries: [], fromCache: false });
  mocks.runSync.mockResolvedValue(true);
  dashboardDom();
  // A prior online session left a valid marker — the offline identity source.
  saveAuthMarker({
    userId: USER,
    role: "user",
    refreshExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
  });
});

describe("initDashboard — offline bootstrap", () => {
  beforeEach(() => {
    mocks.checkAuthStatus.mockResolvedValue({
      isAuthenticated: true,
      setupRequired: false,
      role: "user",
      offline: true,
    });
  });

  it("renders cached entries identified by the auth marker's userId", async () => {
    mocks.loadEntries.mockResolvedValue({ entries: [entry("c1")], fromCache: true });

    await initDashboard();

    expect(mocks.loadEntries).toHaveBeenCalledWith(USER);
    expect(mocks.renderEntryList).toHaveBeenCalledWith([entry("c1")], "kg");
  });

  it("registers the online-event sync trigger but starts no sync run while offline", async () => {
    setPendingOps(USER, [{ type: "delete", id: "x" }]);

    await initDashboard();

    expect(mocks.initSync).toHaveBeenCalledTimes(1);
    expect(mocks.runSync).not.toHaveBeenCalled();
  });

  it("skips the legacy localStorage migration probe while offline", async () => {
    await initDashboard();
    expect(mocks.hasMigratableData).not.toHaveBeenCalled();
  });

  it("renders the chart client-side from local entries", async () => {
    mocks.loadEntries.mockResolvedValue({
      entries: [entry("c1", 80), entry("c2", 81)],
      fromCache: true,
    });

    await initDashboard();

    expect(mocks.renderChart).toHaveBeenCalledTimes(1);
    const dataset = mocks.renderChart.mock.calls[0][1];
    expect(dataset.unit).toBe("kg");
    expect(dataset.dataPoints.length).toBeGreaterThan(0);
  });
});

describe("initDashboard — online bootstrap", () => {
  beforeEach(() => {
    mocks.checkAuthStatus.mockResolvedValue({
      isAuthenticated: true,
      setupRequired: false,
      role: "user",
    });
  });

  it("replays a pending queue left over from an offline session", async () => {
    setPendingOps(USER, [{ type: "delete", id: "x" }]);

    await initDashboard();

    expect(mocks.runSync).toHaveBeenCalledWith(USER);
  });

  it("starts no sync run when the queue is empty", async () => {
    await initDashboard();
    expect(mocks.runSync).not.toHaveBeenCalled();
  });
});

describe("export works from local state", () => {
  it("exports the in-memory entries without refetching from the API", async () => {
    mocks.checkAuthStatus.mockResolvedValue({
      isAuthenticated: true,
      setupRequired: false,
      offline: true,
    });
    mocks.loadEntries.mockResolvedValue({ entries: [entry("c1")], fromCache: true });
    await initDashboard();

    document.getElementById("export-btn")!.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(mocks.generateCSV).toHaveBeenCalledWith([entry("c1")]);
    expect(mocks.triggerDownload).toHaveBeenCalled();
    expect(mocks.apiGetEntries).not.toHaveBeenCalled();
  });
});

describe("entry actions route through the offline-capable store", () => {
  beforeEach(() => {
    mocks.checkAuthStatus.mockResolvedValue({
      isAuthenticated: true,
      setupRequired: false,
      offline: true,
    });
  });

  it("submit adds via entry-store with the current unit", async () => {
    await initDashboard();
    (document.getElementById("weight-input") as HTMLInputElement).value = "82.5";

    document.getElementById("submit-btn")!.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(mocks.addEntry).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ weightValue: 82.5, unit: "kg" })
    );
  });

  it("delete routes through entry-store.removeEntry", async () => {
    mocks.loadEntries.mockResolvedValue({ entries: [entry("c1")], fromCache: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await initDashboard();

    const btn = document.createElement("button");
    btn.setAttribute("data-action", "delete");
    btn.setAttribute("data-id", "c1");
    document.getElementById("entry-list")!.appendChild(btn);
    btn.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(mocks.removeEntry).toHaveBeenCalledWith(USER, "c1");
  });

  it("delete-all routes through entry-store.removeAllEntries", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await initDashboard();

    const btn = document.createElement("button");
    btn.setAttribute("data-action", "delete-all");
    document.getElementById("entry-list")!.appendChild(btn);
    btn.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(mocks.removeAllEntries).toHaveBeenCalledWith(USER);
  });
});
