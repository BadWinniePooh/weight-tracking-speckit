import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockGetEntries, mockCreateEntry, mockDeleteEntry, mockGetSettings, FakeApiError } = vi.hoisted(() => {
  class FakeApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  }
  return {
    mockGetEntries: vi.fn(),
    mockCreateEntry: vi.fn(),
    mockDeleteEntry: vi.fn(),
    mockGetSettings: vi.fn(),
    FakeApiError,
  };
});

vi.mock("../src/ts/api-client", () => ({
  getEntries: mockGetEntries,
  createEntry: mockCreateEntry,
  deleteEntry: mockDeleteEntry,
  deleteAllEntries: vi.fn(),
  getSettings: mockGetSettings,
  ApiError: FakeApiError,
}));

import { runSync, initSync } from "../src/ts/sync";
import {
  setPendingOps,
  getPendingOps,
  getCachedEntries,
} from "../src/ts/offline-store";
import type { PendingOp } from "../src/ts/offline-store";
import type { WeightEntry } from "../src/ts/model";

const USER = "11111111-1111-1111-1111-111111111111";
const offline = () => new TypeError("Failed to fetch");

function entry(id: string, weight = 80): WeightEntry {
  return { id, weightValue: weight, unit: "kg", timestamp: "2026-07-30T08:00:00.000Z" };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockGetEntries.mockResolvedValue({ entries: [] });
  mockGetSettings.mockResolvedValue({
    preferredUnit: "kg", weightGoal: null, lossRate: 0.0055, carbFatRatio: 0.6, bufferValue: 0.0075,
  });
});

describe("runSync", () => {
  it("replays the queue in FIFO order and drains it", async () => {
    const calls: string[] = [];
    mockCreateEntry.mockImplementation(async (p: { id: string }) => { calls.push(`create:${p.id}`); return entry(p.id); });
    mockDeleteEntry.mockImplementation(async (id: string) => { calls.push(`delete:${id}`); });
    setPendingOps(USER, [
      { type: "create", entry: entry("a") },
      { type: "delete", id: "b" },
      { type: "create", entry: entry("c") },
    ]);

    const synced = await runSync(USER);

    expect(synced).toBe(true);
    expect(calls).toEqual(["create:a", "delete:b", "create:c"]);
    expect(getPendingOps(USER)).toEqual([]);
  });

  it("network failure mid-queue stops the run and keeps the remaining ops", async () => {
    mockCreateEntry
      .mockResolvedValueOnce(entry("a"))
      .mockRejectedValueOnce(offline());
    setPendingOps(USER, [
      { type: "create", entry: entry("a") },
      { type: "create", entry: entry("b") },
      { type: "create", entry: entry("c") },
    ]);

    const synced = await runSync(USER);

    expect(synced).toBe(false);
    const remaining = getPendingOps(USER).map((op: PendingOp) => op.type === "create" ? op.entry.id : "");
    expect(remaining).toEqual(["b", "c"]);
  });

  it("drops a delete that 404s and continues", async () => {
    mockDeleteEntry.mockRejectedValue(new FakeApiError("not found", 404));
    mockCreateEntry.mockResolvedValue(entry("x"));
    setPendingOps(USER, [
      { type: "delete", id: "gone" },
      { type: "create", entry: entry("x") },
    ]);

    const synced = await runSync(USER);

    expect(synced).toBe(true);
    expect(getPendingOps(USER)).toEqual([]);
    expect(mockCreateEntry).toHaveBeenCalledTimes(1);
  });

  it("drops a create the server rejects (4xx) and continues", async () => {
    mockCreateEntry
      .mockRejectedValueOnce(new FakeApiError("conflict", 409))
      .mockResolvedValueOnce(entry("ok"));
    setPendingOps(USER, [
      { type: "create", entry: entry("bad") },
      { type: "create", entry: entry("ok") },
    ]);

    const synced = await runSync(USER);

    expect(synced).toBe(true);
    expect(getPendingOps(USER)).toEqual([]);
  });

  it("after draining, refetches entries and settings into the caches", async () => {
    mockGetEntries.mockResolvedValue({ entries: [entry("server1")] });
    setPendingOps(USER, []);

    await runSync(USER);

    expect(getCachedEntries(USER)).toEqual([entry("server1")]);
  });

  it("is single-flight: concurrent calls share one run", async () => {
    let resolveCreate!: (v: WeightEntry) => void;
    mockCreateEntry.mockImplementation(() => new Promise((res) => { resolveCreate = res; }));
    setPendingOps(USER, [{ type: "create", entry: entry("slow") }]);

    const p1 = runSync(USER);
    const p2 = runSync(USER);
    resolveCreate(entry("slow"));
    await Promise.all([p1, p2]);

    expect(mockCreateEntry).toHaveBeenCalledTimes(1);
  });
});

describe("initSync", () => {
  it("runs sync and the callback when the online event fires", async () => {
    const onAfterSync = vi.fn().mockResolvedValue(undefined);
    setPendingOps(USER, []);

    initSync({ getUserId: () => USER, onAfterSync });
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(onAfterSync).toHaveBeenCalled());
  });

  it("does nothing when no user is known", async () => {
    const onAfterSync = vi.fn();
    initSync({ getUserId: () => null, onAfterSync });
    window.dispatchEvent(new Event("online"));
    await new Promise((r) => setTimeout(r, 20));
    expect(onAfterSync).not.toHaveBeenCalled();
  });
});
