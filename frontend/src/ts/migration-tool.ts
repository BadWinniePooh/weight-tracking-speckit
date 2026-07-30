import { migrateFromLocalStorage } from "./api-client";
import type { MigrationResult } from "./api-client";

const ENTRIES_KEY = "weight_tracker_entries";
const PREFS_KEY = "weight_tracker_preferences";

export async function runMigration(): Promise<MigrationResult> {
  // Read entries from localStorage
  const entriesRaw = localStorage.getItem(ENTRIES_KEY);
  let entries: Array<{ id?: string; weightValue: number; unit: string; timestamp: string }> = [];
  if (entriesRaw) {
    try {
      const parsed = JSON.parse(entriesRaw);
      if (Array.isArray(parsed)) {
        entries = parsed;
      }
    } catch {
      // malformed localStorage — send empty
    }
  }

  // Read preferences/settings from localStorage
  const prefsRaw = localStorage.getItem(PREFS_KEY);
  let settings: { preferredUnit: string; weightGoal: number | null; lossRate: number; carbFatRatio: number; bufferValue: number } | undefined;
  if (prefsRaw) {
    try {
      const parsed = JSON.parse(prefsRaw);
      if (parsed && typeof parsed === "object") {
        settings = {
          preferredUnit: parsed.unit ?? "kg",
          weightGoal: null,
          lossRate: 0.0055,
          carbFatRatio: 0.6,
          bufferValue: 0.0075,
        };
      }
    } catch {
      // ignore
    }
  }

  return migrateFromLocalStorage({ entries, settings });
}

export function hasMigratableData(): boolean {
  const raw = localStorage.getItem(ENTRIES_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}
