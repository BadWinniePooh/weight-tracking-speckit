import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../src/ts/config", () => ({
  loadConfig: vi.fn().mockResolvedValue(undefined),
  getApiUrl: vi.fn().mockReturnValue(""),
}));

import { checkAuthStatus } from "../src/ts/auth-guard";
import { saveAuthMarker, getAuthMarker } from "../src/ts/offline-store";
import { clearAccessToken } from "../src/ts/auth-token";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function fakeJwt(sub: string, role: string): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode({ sub, role })}.sig`;
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

function validMarker(daysFromNow = 5) {
  return {
    userId: USER_ID,
    role: "user",
    refreshExpiresAt: new Date(Date.now() + daysFromNow * 86400_000).toISOString(),
  };
}

beforeEach(() => {
  localStorage.clear();
  clearAccessToken();
  mockFetch.mockReset();
});

describe("checkAuthStatus — offline (network unreachable)", () => {
  it("valid marker → authenticated offline with the marker's role", async () => {
    saveAuthMarker(validMarker());
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const state = await checkAuthStatus();

    expect(state.isAuthenticated).toBe(true);
    expect(state.offline).toBe(true);
    expect(state.role).toBe("user");
    expect(state.setupRequired).toBe(false);
  });

  it("expired marker → unauthenticated (redirects to login downstream)", async () => {
    saveAuthMarker({ ...validMarker(), refreshExpiresAt: new Date(Date.now() - 1000).toISOString() });
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const state = await checkAuthStatus();

    expect(state.isAuthenticated).toBe(false);
    expect(state.setupRequired).toBe(false);
  });

  it("no marker → unauthenticated", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const state = await checkAuthStatus();
    expect(state.isAuthenticated).toBe(false);
  });

  it("network drop between setup-status and refresh → offline path with valid marker", async () => {
    saveAuthMarker(validMarker());
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ firstRun: false }) })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const state = await checkAuthStatus();

    expect(state.isAuthenticated).toBe(true);
    expect(state.offline).toBe(true);
  });
});

describe("checkAuthStatus — online", () => {
  it("successful refresh writes a fresh 7-day marker", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ firstRun: false }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: fakeJwt(USER_ID, "admin") }),
      });

    const before = Date.now();
    const state = await checkAuthStatus();

    expect(state.isAuthenticated).toBe(true);
    expect(state.offline).toBeUndefined();

    const marker = getAuthMarker();
    expect(marker).not.toBeNull();
    expect(marker!.userId).toBe(USER_ID);
    expect(marker!.role).toBe("admin");
    const expiry = Date.parse(marker!.refreshExpiresAt);
    const sevenDays = 7 * 86400_000;
    expect(expiry).toBeGreaterThanOrEqual(before + sevenDays - 5000);
    expect(expiry).toBeLessThanOrEqual(Date.now() + sevenDays + 5000);
  });

  it("refresh rejected by the server (401) clears the marker", async () => {
    saveAuthMarker(validMarker());
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ firstRun: false }) })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    const state = await checkAuthStatus();

    expect(state.isAuthenticated).toBe(false);
    expect(getAuthMarker()).toBeNull();
  });
});
