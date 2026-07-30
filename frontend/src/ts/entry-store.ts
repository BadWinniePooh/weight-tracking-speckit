import {
  getEntries as apiGetEntries,
  createEntry as apiCreateEntry,
  deleteEntry as apiDeleteEntry,
  deleteAllEntries as apiDeleteAllEntries,
  getSettings as apiGetSettings,
} from "./api-client";
import {
  getCachedEntries,
  setCachedEntries,
  getPendingOps,
  setPendingOps,
  enqueueOp,
  getCachedSettings,
  setCachedSettings,
} from "./offline-store";
import type { WeightEntry, WeightUnit, ChartSettings } from "./model";

// Online-first entry repository with an offline fallback. Every mutation is
// applied to the local cache immediately; when the network is down the
// operation is queued for sync.ts to replay. Only a fetch-level network
// failure (TypeError) triggers the offline path — server errors propagate.

// Matches the server-side seeding defaults in ChartSettingsRepository.
const DEFAULT_SETTINGS: ChartSettings = {
  preferredUnit: "kg",
  weightGoal: null,
  lossRate: 0.0055,
  carbFatRatio: 0.6,
  bufferValue: 0.0075,
};

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

/**
 * Cache with the pending queue overlaid: deletes hide, creates add. Idempotent —
 * a pending create already present in the cache (optimistic write) is not
 * duplicated, and a fresh server fetch that lacks the pending entries gets them
 * re-added until sync confirms them.
 */
function overlayPending(userId: string): WeightEntry[] {
  const pending = getPendingOps(userId);
  const deleted = new Set(pending.filter((op) => op.type === "delete").map((op) => op.id));
  const kept = getCachedEntries(userId).filter((e) => !deleted.has(e.id));
  const present = new Set(kept.map((e) => e.id));
  const created = pending.flatMap((op) =>
    op.type === "create" && !present.has(op.entry.id) ? [op.entry] : []
  );
  return [...kept, ...created];
}

export async function loadEntries(
  userId: string
): Promise<{ entries: WeightEntry[]; fromCache: boolean }> {
  try {
    const response = await apiGetEntries();
    setCachedEntries(userId, response.entries);
    return { entries: overlayPending(userId), fromCache: false };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return { entries: overlayPending(userId), fromCache: true };
  }
}

export async function addEntry(
  userId: string,
  payload: { weightValue: number; unit: WeightUnit | string; timestamp: string }
): Promise<void> {
  // The client generates the id so an offline entry and its later replay are
  // the same entry — the server dedups by id (idempotent POST).
  const newEntry: WeightEntry = {
    id: crypto.randomUUID(),
    weightValue: payload.weightValue,
    unit: payload.unit as WeightUnit,
    timestamp: payload.timestamp,
  };
  try {
    await apiCreateEntry({ id: newEntry.id, ...payload });
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    enqueueOp(userId, { type: "create", entry: newEntry });
  }
  // The cache holds the optimistic local view either way.
  setCachedEntries(userId, [...getCachedEntries(userId), newEntry]);
}

export async function removeEntry(userId: string, id: string): Promise<void> {
  const pending = getPendingOps(userId);
  const isPendingCreate = pending.some((op) => op.type === "create" && op.entry.id === id);
  if (isPendingCreate) {
    // Never synced — cancel the queued create; the server must never hear of it.
    setPendingOps(
      userId,
      pending.filter((op) => !(op.type === "create" && op.entry.id === id))
    );
    setCachedEntries(userId, getCachedEntries(userId).filter((e) => e.id !== id));
    return;
  }

  try {
    await apiDeleteEntry(id);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    enqueueOp(userId, { type: "delete", id });
  }
  setCachedEntries(userId, getCachedEntries(userId).filter((e) => e.id !== id));
}

export async function removeAllEntries(userId: string): Promise<void> {
  try {
    await apiDeleteAllEntries();
    setCachedEntries(userId, []);
    setPendingOps(userId, []);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    // Offline delete-all: cancel every pending create and tombstone only the
    // synced ids this client has seen — a never-synced entry needs no tombstone
    // (the server never heard of it), and entries created meanwhile on another
    // device survive (append-everything policy, FR-004).
    const pending = getPendingOps(userId);
    const neverSynced = new Set(
      pending.filter((op) => op.type === "create").map((op) => op.entry.id)
    );
    const keptDeletes = pending.filter((op) => op.type === "delete");
    const syncedIds = getCachedEntries(userId)
      .map((e) => e.id)
      .filter((id) => !neverSynced.has(id));
    setPendingOps(userId, [
      ...keptDeletes,
      ...syncedIds.map((id) => ({ type: "delete" as const, id })),
    ]);
    setCachedEntries(userId, []);
  }
}

export async function loadSettings(userId: string): Promise<ChartSettings> {
  try {
    const settings = await apiGetSettings();
    setCachedSettings(userId, settings);
    return settings;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return getCachedSettings(userId) ?? DEFAULT_SETTINGS;
  }
}
