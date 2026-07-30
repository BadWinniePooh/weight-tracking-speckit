import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockGetEntries, mockCreateEntry, mockDeleteEntry, mockDeleteAllEntries, mockGetSettings } = vi.hoisted(() => ({
  mockGetEntries: vi.fn(),
  mockCreateEntry: vi.fn(),
  mockDeleteEntry: vi.fn(),
  mockDeleteAllEntries: vi.fn(),
  mockGetSettings: vi.fn(),
}));

vi.mock("../src/ts/api-client", () => ({
  getEntries: mockGetEntries,
  createEntry: mockCreateEntry,
  deleteEntry: mockDeleteEntry,
  deleteAllEntries: mockDeleteAllEntries,
  getSettings: mockGetSettings,
  ApiError: class ApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

import {
  loadEntries,
  addEntry,
  removeEntry,
  removeAllEntries,
  loadSettings,
} from "../src/ts/entry-store";
import {
  getCachedEntries,
  setCachedEntries,
  getPendingOps,
  setPendingOps,
  setCachedSettings,
} from "../src/ts/offline-store";
import type { WeightEntry } from "../src/ts/model";

const USER = "11111111-1111-1111-1111-111111111111";
const offline = () => new TypeError("Failed to fetch");

function entry(id: string, weight = 80): WeightEntry {
  return { id, weightValue: weight, unit: "kg", timestamp: "2026-07-30T08:00:00.000Z" };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("loadEntries", () => {
  it("online: returns server entries and refreshes the cache", async () => {
    mockGetEntries.mockResolvedValue({ entries: [entry("s1")] });

    const result = await loadEntries(USER);

    expect(result.fromCache).toBe(false);
    expect(result.entries).toEqual([entry("s1")]);
    expect(getCachedEntries(USER)).toEqual([entry("s1")]);
  });

  it("offline: serves the cache with pending ops overlaid", async () => {
    setCachedEntries(USER, [entry("s1"), entry("s2")]);
    setPendingOps(USER, [
      { type: "delete", id: "s2" },
      { type: "create", entry: entry("p1", 99) },
    ]);
    mockGetEntries.mockRejectedValue(offline());

    const result = await loadEntries(USER);

    expect(result.fromCache).toBe(true);
    expect(result.entries.map((e) => e.id).sort()).toEqual(["p1", "s1"]);
  });

  it("non-network errors propagate (no silent cache fallback on server errors)", async () => {
    const { ApiError } = await import("../src/ts/api-client");
    mockGetEntries.mockRejectedValue(new ApiError("boom", 500));
    await expect(loadEntries(USER)).rejects.toThrow("boom");
  });
});

describe("addEntry", () => {
  it("generates a client id and sends it to the server when online", async () => {
    mockCreateEntry.mockImplementation(async (p: { id: string }) => ({ ...entry(p.id) }));
    mockGetEntries.mockResolvedValue({ entries: [] });

    await addEntry(USER, { weightValue: 81, unit: "kg", timestamp: "2026-07-30T09:00:00.000Z" });

    expect(mockCreateEntry).toHaveBeenCalledTimes(1);
    const payload = mockCreateEntry.mock.calls[0][0];
    expect(payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(getPendingOps(USER)).toEqual([]);
  });

  it("offline: queues the create and applies it to the cache", async () => {
    mockCreateEntry.mockRejectedValue(offline());

    await addEntry(USER, { weightValue: 82, unit: "kg", timestamp: "2026-07-30T09:00:00.000Z" });

    const ops = getPendingOps(USER);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("create");
    const cached = getCachedEntries(USER);
    expect(cached).toHaveLength(1);
    expect(cached[0].weightValue).toBe(82);
  });
});

describe("removeEntry", () => {
  it("cancels a pending create instead of queueing a delete", async () => {
    mockCreateEntry.mockRejectedValue(offline());
    await addEntry(USER, { weightValue: 82, unit: "kg", timestamp: "2026-07-30T09:00:00.000Z" });
    const pendingId = getCachedEntries(USER)[0].id;

    mockDeleteEntry.mockRejectedValue(offline());
    await removeEntry(USER, pendingId);

    // Nothing must ever reach the server for this entry
    expect(getPendingOps(USER)).toEqual([]);
    expect(getCachedEntries(USER)).toEqual([]);
    expect(mockDeleteEntry).not.toHaveBeenCalled();
  });

  it("offline: queues a delete for a synced entry and drops it from cache", async () => {
    setCachedEntries(USER, [entry("s1")]);
    mockDeleteEntry.mockRejectedValue(offline());

    await removeEntry(USER, "s1");

    expect(getPendingOps(USER)).toEqual([{ type: "delete", id: "s1" }]);
    expect(getCachedEntries(USER)).toEqual([]);
  });

  it("online: deletes on the server and updates the cache", async () => {
    setCachedEntries(USER, [entry("s1")]);
    mockDeleteEntry.mockResolvedValue(undefined);

    await removeEntry(USER, "s1");

    expect(mockDeleteEntry).toHaveBeenCalledWith("s1");
    expect(getPendingOps(USER)).toEqual([]);
    expect(getCachedEntries(USER)).toEqual([]);
  });
});

describe("removeAllEntries", () => {
  it("online: uses the bulk endpoint", async () => {
    setCachedEntries(USER, [entry("s1"), entry("s2")]);
    mockDeleteAllEntries.mockResolvedValue(undefined);

    await removeAllEntries(USER);

    expect(mockDeleteAllEntries).toHaveBeenCalledTimes(1);
    expect(getCachedEntries(USER)).toEqual([]);
    expect(getPendingOps(USER)).toEqual([]);
  });

  it("offline: tombstones only ids this client has seen and cancels pending creates", async () => {
    setCachedEntries(USER, [entry("s1"), entry("s2")]);
    mockCreateEntry.mockRejectedValue(offline());
    await addEntry(USER, { weightValue: 90, unit: "kg", timestamp: "2026-07-30T10:00:00.000Z" });

    mockDeleteAllEntries.mockRejectedValue(offline());
    await removeAllEntries(USER);

    const ops = getPendingOps(USER);
    // The pending create is cancelled, never sent; the two synced ids get tombstones.
    expect(ops.every((op) => op.type === "delete")).toBe(true);
    expect(ops.map((op) => (op.type === "delete" ? op.id : "")).sort()).toEqual(["s1", "s2"]);
    expect(getCachedEntries(USER)).toEqual([]);
  });
});

describe("loadSettings", () => {
  it("online: caches and returns server settings", async () => {
    const settings = { preferredUnit: "kg", weightGoal: 70, lossRate: 0.0055, carbFatRatio: 0.6, bufferValue: 0.0075 };
    mockGetSettings.mockResolvedValue(settings);

    expect(await loadSettings(USER)).toEqual(settings);
    mockGetSettings.mockRejectedValue(offline());
    expect(await loadSettings(USER)).toEqual(settings); // now from cache
  });

  it("offline with no cache: returns the known defaults", async () => {
    mockGetSettings.mockRejectedValue(offline());
    const settings = await loadSettings(USER);
    expect(settings.lossRate).toBeCloseTo(0.0055);
    expect(settings.weightGoal).toBeNull();
  });

  it("uses the settings cache written by setCachedSettings", async () => {
    const cached = { preferredUnit: "lbs", weightGoal: 150, lossRate: 0.005, carbFatRatio: 0.5, bufferValue: 0.008 };
    setCachedSettings(USER, cached);
    mockGetSettings.mockRejectedValue(offline());
    expect(await loadSettings(USER)).toEqual(cached);
  });
});
