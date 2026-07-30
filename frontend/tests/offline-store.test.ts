import { describe, it, expect, beforeEach } from "vitest";
import {
  saveAuthMarker,
  getAuthMarker,
  clearAuthMarker,
  isMarkerValid,
  getCachedEntries,
  setCachedEntries,
  getPendingOps,
  setPendingOps,
  enqueueOp,
  getCachedSettings,
  setCachedSettings,
  getCachedConfig,
  setCachedConfig,
  type PendingOp,
} from "../src/ts/offline-store";
import type { WeightEntry, ChartSettings } from "../src/ts/model";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function entry(id: string, weight = 80): WeightEntry {
  return { id, weightValue: weight, unit: "kg", timestamp: "2026-07-30T08:00:00.000Z" };
}

beforeEach(() => {
  localStorage.clear();
});

describe("auth marker", () => {
  it("round-trips the marker", () => {
    saveAuthMarker({ userId: USER_A, role: "user", refreshExpiresAt: "2026-08-06T00:00:00.000Z" });
    expect(getAuthMarker()).toEqual({
      userId: USER_A,
      role: "user",
      refreshExpiresAt: "2026-08-06T00:00:00.000Z",
    });
  });

  it("returns null when absent", () => {
    expect(getAuthMarker()).toBeNull();
  });

  it("clearAuthMarker removes it", () => {
    saveAuthMarker({ userId: USER_A, role: "user", refreshExpiresAt: "2026-08-06T00:00:00.000Z" });
    clearAuthMarker();
    expect(getAuthMarker()).toBeNull();
  });

  it("isMarkerValid is true before expiry and false after", () => {
    const in1h = new Date(Date.now() + 3600_000).toISOString();
    saveAuthMarker({ userId: USER_A, role: "user", refreshExpiresAt: in1h });
    expect(isMarkerValid()).toBe(true);

    const past = new Date(Date.now() - 1000).toISOString();
    saveAuthMarker({ userId: USER_A, role: "user", refreshExpiresAt: past });
    expect(isMarkerValid()).toBe(false);
  });

  it("isMarkerValid is false with no marker or corrupt marker", () => {
    expect(isMarkerValid()).toBe(false);
    localStorage.setItem("wt_offline::auth", "{not json");
    expect(isMarkerValid()).toBe(false);
    expect(getAuthMarker()).toBeNull();
  });
});

describe("entry cache", () => {
  it("round-trips entries per user", () => {
    setCachedEntries(USER_A, [entry("e1")]);
    expect(getCachedEntries(USER_A)).toEqual([entry("e1")]);
  });

  it("isolates users", () => {
    setCachedEntries(USER_A, [entry("e1")]);
    setCachedEntries(USER_B, [entry("e2")]);
    expect(getCachedEntries(USER_A)).toEqual([entry("e1")]);
    expect(getCachedEntries(USER_B)).toEqual([entry("e2")]);
  });

  it("returns [] when empty or corrupt", () => {
    expect(getCachedEntries(USER_A)).toEqual([]);
    localStorage.setItem(`wt_offline::${USER_A}::entries`, "[broken");
    expect(getCachedEntries(USER_A)).toEqual([]);
  });
});

describe("pending queue", () => {
  it("enqueueOp appends in FIFO order", () => {
    const create: PendingOp = { type: "create", entry: entry("e1") };
    const del: PendingOp = { type: "delete", id: "e0" };
    enqueueOp(USER_A, create);
    enqueueOp(USER_A, del);
    expect(getPendingOps(USER_A)).toEqual([create, del]);
  });

  it("setPendingOps replaces the queue", () => {
    enqueueOp(USER_A, { type: "delete", id: "x" });
    setPendingOps(USER_A, []);
    expect(getPendingOps(USER_A)).toEqual([]);
  });

  it("queue is per-user", () => {
    enqueueOp(USER_A, { type: "delete", id: "a" });
    expect(getPendingOps(USER_B)).toEqual([]);
  });
});

describe("settings cache", () => {
  it("round-trips and defaults to null", () => {
    expect(getCachedSettings(USER_A)).toBeNull();
    const settings: ChartSettings = {
      preferredUnit: "kg",
      weightGoal: 75,
      lossRate: 0.0055,
      carbFatRatio: 0.6,
      bufferValue: 0.0075,
    };
    setCachedSettings(USER_A, settings);
    expect(getCachedSettings(USER_A)).toEqual(settings);
  });
});

describe("config cache", () => {
  it("round-trips and defaults to null", () => {
    expect(getCachedConfig()).toBeNull();
    setCachedConfig({ apiUrl: "https://example.com" });
    expect(getCachedConfig()).toEqual({ apiUrl: "https://example.com" });
  });
});

describe("key namespace", () => {
  it("never touches the legacy migration keys", () => {
    saveAuthMarker({ userId: USER_A, role: "user", refreshExpiresAt: "2026-08-06T00:00:00.000Z" });
    setCachedEntries(USER_A, [entry("e1")]);
    enqueueOp(USER_A, { type: "delete", id: "x" });
    setCachedConfig({ apiUrl: "x" });

    // migration-tool.ts scans weight_tracker_entries on every main-page load;
    // colliding with it would resurrect the feature-001 migration button.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(key.startsWith("wt_offline::")).toBe(true);
      expect(key.startsWith("weight_tracker")).toBe(false);
    }
  });
});
