import {
  getEntries as apiGetEntries,
  createEntry as apiCreateEntry,
  deleteEntry as apiDeleteEntry,
  getSettings as apiGetSettings,
  ApiError,
} from "./api-client";
import {
  getPendingOps,
  setPendingOps,
  setCachedEntries,
  setCachedSettings,
} from "./offline-store";

// Automatic sync engine (FR-007..FR-010). Replays the pending queue in FIFO
// order, then refreshes the caches from the server. Runs with no user
// interaction: on app load once authenticated and on the browser's `online`
// event. Single-flight per tab — replays from two triggers never interleave.

let _syncPromise: Promise<boolean> | null = null;

/**
 * Replays the user's pending queue against the server, then refetches
 * entries and settings into the caches. Returns true when the queue fully
 * drained and the caches were refreshed; false when a network failure
 * interrupted the run (the remaining queue is preserved — the next trigger
 * retries from where this run stopped).
 */
export function runSync(userId: string): Promise<boolean> {
  if (_syncPromise) return _syncPromise;

  _syncPromise = (async () => {
    let ops = getPendingOps(userId);
    while (ops.length > 0) {
      const op = ops[0];
      try {
        if (op.type === "create") {
          // Replays are idempotent: the server dedups by the client-generated id.
          await apiCreateEntry({
            id: op.entry.id,
            weightValue: op.entry.weightValue,
            unit: op.entry.unit,
            timestamp: op.entry.timestamp,
          });
        } else {
          await apiDeleteEntry(op.id);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          // The server answered: a 404 delete is already done, a rejected
          // create (409 id conflict, validation) can never succeed — drop the
          // op rather than wedge the queue, and carry on.
          ops = ops.slice(1);
          setPendingOps(userId, ops);
          continue;
        }
        // Network failure — keep the remaining queue for the next trigger.
        return false;
      }
      ops = ops.slice(1);
      setPendingOps(userId, ops);
    }

    try {
      const [entries, settings] = await Promise.all([apiGetEntries(), apiGetSettings()]);
      setCachedEntries(userId, entries.entries);
      setCachedSettings(userId, settings);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    _syncPromise = null;
  });

  return _syncPromise;
}

interface SyncOptions {
  getUserId: () => string | null;
  onAfterSync: () => Promise<void> | void;
}

let _onlineListener: (() => void) | null = null;

/**
 * Registers the automatic triggers. Safe to call more than once — the
 * previous `online` listener is replaced, not stacked.
 */
export function initSync(opts: SyncOptions): void {
  if (_onlineListener) window.removeEventListener("online", _onlineListener);
  _onlineListener = () => {
    const userId = opts.getUserId();
    if (!userId) return;
    void runSync(userId).then((synced) => {
      if (synced) return opts.onAfterSync();
    });
  };
  window.addEventListener("online", _onlineListener);
}
