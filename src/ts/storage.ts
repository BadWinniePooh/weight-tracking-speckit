import type { WeightEntry, UserPreferences, ChartSettings } from "./model";

const ENTRIES_KEY = "weight_tracker_entries";
const PREFS_KEY = "weight_tracker_preferences";
const CHART_SETTINGS_KEY = "weight_tracker_chart_settings";

const DEFAULT_CHART_SETTINGS: ChartSettings = {
  weightGoal: null,
  lossRate: 0.0055,
  carbFatRatio: 0.6,
  bufferValue: 0.0075,
};

let _dataCorrupt = false;

export function loadEntries(): WeightEntry[] {
  _dataCorrupt = false; // reset on each load attempt
  const raw = localStorage.getItem(ENTRIES_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    console.log(parsed);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.sort(
      (a: WeightEntry, b: WeightEntry) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    _dataCorrupt = true;
    return [];
  }
}

export function saveEntries(entries: WeightEntry[]): void {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new Error("Storage is full. Please delete some entries first.");
    }
    throw err;
  }
}

export function loadPreferences(): UserPreferences {
  const raw = localStorage.getItem(PREFS_KEY);
  if (raw === null) {
    return { unit: "kg" };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") {
      return { unit: "kg" };
    }
    return parsed as UserPreferences;
  } catch {
    return { unit: "kg" };
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new Error("Storage is full. Please delete some entries first.");
    }
    throw err;
  }
}

export function loadChartSettings(): ChartSettings {
  const raw = localStorage.getItem(CHART_SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_CHART_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return { ...DEFAULT_CHART_SETTINGS };
    return { ...DEFAULT_CHART_SETTINGS, ...parsed } as ChartSettings;
  } catch {
    return { ...DEFAULT_CHART_SETTINGS };
  }
}

export function saveChartSettings(settings: ChartSettings): void {
  localStorage.setItem(CHART_SETTINGS_KEY, JSON.stringify(settings));
}

export function isDataCorrupt(): boolean {
  return _dataCorrupt;
}

export function getRawStorageString(): string {
  return localStorage.getItem(ENTRIES_KEY) ?? "";
}
