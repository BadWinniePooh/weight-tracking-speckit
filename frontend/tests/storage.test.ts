import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadEntries,
  saveEntries,
  loadPreferences,
  savePreferences,
  isDataCorrupt,
  getRawStorageString,
  loadChartSettings,
  saveChartSettings,
} from "../src/ts/storage";
import type { WeightEntry, ChartSettings } from "../src/ts/model";

const ENTRIES_KEY = "weight_tracker_entries";
const PREFS_KEY = "weight_tracker_preferences";

const sampleEntries: WeightEntry[] = [
  {
    id: "id-1",
    weightValue: 82.5,
    unit: "kg",
    timestamp: "2026-03-13T09:15:00.000Z",
  },
  {
    id: "id-2",
    weightValue: 83.0,
    unit: "kg",
    timestamp: "2026-03-12T08:00:00.000Z",
  },
];

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("loadEntries", () => {
  it("returns [] when key is absent", () => {
    expect(loadEntries()).toEqual([]);
  });

  it("returns [] when stored value is null", () => {
    localStorage.setItem(ENTRIES_KEY, "null");
    expect(loadEntries()).toEqual([]);
  });

  it("returns [] and sets corrupt flag when stored JSON is malformed", () => {
    localStorage.setItem(ENTRIES_KEY, "not valid json{{{");
    const result = loadEntries();
    expect(result).toEqual([]);
    expect(isDataCorrupt()).toBe(true);
  });

  it("preserves all fields in a round-trip", () => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(sampleEntries));
    const result = loadEntries();
    expect(result[0].id).toBe("id-1");
    expect(result[0].weightValue).toBe(82.5);
    expect(result[0].unit).toBe("kg");
    expect(result[0].timestamp).toBe("2026-03-13T09:15:00.000Z");
  });

  it("sorts entries descending by timestamp (newest first)", () => {
    const unsorted: WeightEntry[] = [
      { id: "old", weightValue: 80, unit: "kg", timestamp: "2026-01-01T00:00:00.000Z" },
      { id: "new", weightValue: 85, unit: "kg", timestamp: "2026-03-13T00:00:00.000Z" },
      { id: "mid", weightValue: 82, unit: "kg", timestamp: "2026-02-01T00:00:00.000Z" },
    ];
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(unsorted));
    const result = loadEntries();
    expect(result[0].id).toBe("new");
    expect(result[1].id).toBe("mid");
    expect(result[2].id).toBe("old");
  });
});

describe("saveEntries + loadEntries round-trip", () => {
  it("persists and retrieves entries correctly", () => {
    saveEntries(sampleEntries);
    const result = loadEntries();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("id-1");
    expect(result[1].id).toBe("id-2");
  });

  it("throws user-facing error on QuotaExceededError", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new DOMException("QuotaExceededError", "QuotaExceededError");
      throw err;
    });
    expect(() => saveEntries(sampleEntries)).toThrow(
      "Storage is full. Please delete some entries first."
    );
  });
});

describe("loadPreferences", () => {
  it("returns { unit: 'kg' } when key is absent", () => {
    expect(loadPreferences()).toEqual({ unit: "kg" });
  });

  it("returns { unit: 'kg' } when stored value is null", () => {
    localStorage.setItem(PREFS_KEY, "null");
    expect(loadPreferences()).toEqual({ unit: "kg" });
  });
});

describe("savePreferences + loadPreferences round-trip", () => {
  it("persists lbs preference", () => {
    savePreferences({ unit: "lbs" });
    expect(loadPreferences()).toEqual({ unit: "lbs" });
  });

  it("persists kg preference", () => {
    savePreferences({ unit: "kg" });
    expect(loadPreferences()).toEqual({ unit: "kg" });
  });
});

describe("isDataCorrupt", () => {
  it("returns false initially when no data has been loaded", () => {
    expect(isDataCorrupt()).toBe(false);
  });

  it("returns false after loading valid data", () => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(sampleEntries));
    loadEntries();
    expect(isDataCorrupt()).toBe(false);
  });

  it("returns true only after loading corrupt JSON", () => {
    localStorage.setItem(ENTRIES_KEY, "{bad json");
    loadEntries();
    expect(isDataCorrupt()).toBe(true);
  });
});

describe("loadChartSettings", () => {
  it("returns defaults when key is absent", () => {
    const settings = loadChartSettings();
    expect(settings.lossRate).toBe(0.0055);
    expect(settings.carbFatRatio).toBe(0.6);
    expect(settings.bufferValue).toBe(0.0075);
    expect(settings.weightGoal).toBeNull();
  });

  it("returns defaults when key is empty string", () => {
    localStorage.setItem("weight_tracker_chart_settings", "");
    const settings = loadChartSettings();
    expect(settings.weightGoal).toBeNull();
    expect(settings.lossRate).toBe(0.0055);
  });

  it("returns defaults when stored JSON is malformed", () => {
    localStorage.setItem("weight_tracker_chart_settings", "{bad json");
    expect(loadChartSettings().lossRate).toBe(0.0055);
  });
});

describe("saveChartSettings + loadChartSettings round-trip", () => {
  it("persists and retrieves full settings", () => {
    const settings: ChartSettings = {
      preferredUnit: "kg",
      weightGoal: 75.0,
      lossRate: 0.004,
      carbFatRatio: 0.5,
      bufferValue: 0.01,
    };
    saveChartSettings(settings);
    const loaded = loadChartSettings();
    expect(loaded.weightGoal).toBe(75.0);
    expect(loaded.lossRate).toBe(0.004);
    expect(loaded.carbFatRatio).toBe(0.5);
    expect(loaded.bufferValue).toBe(0.01);
  });

  it("persists weightGoal: null", () => {
    saveChartSettings({ preferredUnit: "kg", weightGoal: null, lossRate: 0.0055, carbFatRatio: 0.6, bufferValue: 0.0075 });
    expect(loadChartSettings().weightGoal).toBeNull();
  });

  it("persists a numeric weightGoal", () => {
    saveChartSettings({ preferredUnit: "kg", weightGoal: 80, lossRate: 0.0055, carbFatRatio: 0.6, bufferValue: 0.0075 });
    expect(loadChartSettings().weightGoal).toBe(80);
  });
});

describe("getRawStorageString", () => {
  it("returns the raw string stored under entries key", () => {
    const raw = '[{"id":"test","weightValue":70,"unit":"kg","timestamp":"2026-01-01T00:00:00.000Z"}]';
    localStorage.setItem(ENTRIES_KEY, raw);
    expect(getRawStorageString()).toBe(raw);
  });

  it("returns empty string when key is absent", () => {
    expect(getRawStorageString()).toBe("");
  });
});
