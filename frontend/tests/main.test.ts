import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/ts/auth-guard", () => ({
  checkAuthStatus: vi.fn().mockResolvedValue({
    setupRequired: false,
    isAuthenticated: true,
  }),
  enforceRedirect: vi.fn(),
}));

const mockClearAccessToken = vi.fn();
vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue("test-token"),
  clearAccessToken: mockClearAccessToken,
}));

vi.mock("../src/ts/config", () => ({
  loadConfig: vi.fn().mockResolvedValue(undefined),
  getApiUrl: vi.fn().mockReturnValue(""),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("logout button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = `
      <div id="app">
        <button id="logout-button">Log out</button>
        <div id="entry-list"></div>
      </div>
    `;
  });

  it("calls POST /api/auth/logout with credentials include on click", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });
    const { initLogout } = await import("../src/ts/main");
    initLogout();

    document.getElementById("logout-button")!.click();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/logout"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
  });

  it("calls clearAccessToken and redirects to /login.html on click", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });
    const { initLogout } = await import("../src/ts/main");
    initLogout();

    document.getElementById("logout-button")!.click();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockClearAccessToken).toHaveBeenCalled();
    expect(window.location.href).toBe("/login.html");
  });

  it("still clears token and redirects even if logout request fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { initLogout } = await import("../src/ts/main");
    initLogout();

    document.getElementById("logout-button")!.click();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockClearAccessToken).toHaveBeenCalled();
    expect(window.location.href).toBe("/login.html");
  });
});
