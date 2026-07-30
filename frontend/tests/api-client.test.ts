import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/ts/config", () => ({
  getApiUrl: vi.fn().mockReturnValue(""),
}));

const mockSetAccessToken = vi.fn();
const mockGetAccessToken = vi.fn();
const mockClearAccessToken = vi.fn();

vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: mockSetAccessToken,
  getAccessToken: mockGetAccessToken,
  clearAccessToken: mockClearAccessToken,
  getUserRole: vi.fn().mockReturnValue("user"),
  getUserId: vi.fn().mockReturnValue("user-id-123"),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("api-client 401 retry with silent refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  it("on 401, calls refresh once, retries original request with new token", async () => {
    mockGetAccessToken.mockReturnValue("old-token");

    // First call returns 401, second (after refresh) returns 200
    let callCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ accessToken: "new-token" }),
        });
      }
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ entries: [] }),
      });
    });

    const { getEntries } = await import("../src/ts/api-client");
    await getEntries();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/refresh"),
      expect.objectContaining({ credentials: "include" })
    );
    expect(mockSetAccessToken).toHaveBeenCalledWith("new-token");
    expect(callCount).toBe(2); // original + retry
  });

  it("on 401 + failed refresh, clears token and redirects to login", async () => {
    mockGetAccessToken.mockReturnValue("old-token");

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/refresh")) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      }
      return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
    });

    const { getEntries } = await import("../src/ts/api-client");
    try {
      await getEntries();
    } catch {
      // expected to throw
    }

    expect(mockClearAccessToken).toHaveBeenCalled();
    expect(window.location.href).toBe("/login.html");
  });

  it("successful refresh writes the offline auth marker; rejected refresh clears it", async () => {
    const { saveAuthMarker, getAuthMarker } = await import("../src/ts/offline-store");
    mockGetAccessToken.mockReturnValue("old-token");
    localStorage.clear();

    // 401 → refresh ok → marker written (identity comes from the mocked auth-token)
    let call = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/refresh")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ accessToken: "t" }) });
      }
      call++;
      return call === 1
        ? Promise.resolve({ ok: false, status: 401, json: async () => ({}) })
        : Promise.resolve({ ok: true, status: 200, json: async () => ({ entries: [] }) });
    });

    const { getEntries } = await import("../src/ts/api-client");
    await getEntries();
    expect(getAuthMarker()?.userId).toBe("user-id-123");

    // 401 → refresh rejected by the server → marker cleared
    saveAuthMarker({ userId: "user-id-123", role: "user", refreshExpiresAt: new Date(Date.now() + 86400_000).toISOString() });
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 401, json: async () => ({}) })
    );
    try {
      await getEntries();
    } catch {
      // expected to throw
    }
    expect(getAuthMarker()).toBeNull();
  });

  it("concurrent 401s trigger only one refresh attempt", async () => {
    mockGetAccessToken.mockReturnValue("old-token");

    let refreshCallCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/refresh")) {
        refreshCallCount++;
        return new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: async () => ({ accessToken: "new-token" }),
          }), 10)
        );
      }
      return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
    });

    const { getEntries, getChartData } = await import("../src/ts/api-client");

    await Promise.allSettled([getEntries(), getChartData()]);

    expect(refreshCallCount).toBe(1);
  });
});
