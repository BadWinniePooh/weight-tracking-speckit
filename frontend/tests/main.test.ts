import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/ts/auth-guard", () => ({
  checkAuthStatus: vi.fn().mockResolvedValue({
    setupRequired: false,
    isAuthenticated: true,
    role: "user",
  }),
  enforceRedirect: vi.fn(),
}));

const mockClearAccessToken = vi.fn();
vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue("test-token"),
  clearAccessToken: mockClearAccessToken,
  getUserRole: vi.fn().mockReturnValue("user"),
  getUserId: vi.fn().mockReturnValue("user-id-123"),
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

describe("navigation visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <a href="/profile.html" id="nav-profile">Profile</a>
      <a href="/admin.html" id="nav-admin" hidden>Admin Dashboard</a>
    `;
  });

  it("#nav-admin remains hidden when state.role is 'user'", async () => {
    const { checkAuthStatus } = await import("../src/ts/auth-guard");
    (checkAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      isAuthenticated: true,
      setupRequired: false,
      role: "user",
    });

    const { applyNavVisibility } = await import("../src/ts/main");
    await applyNavVisibility();

    const adminLink = document.getElementById("nav-admin") as HTMLElement;
    expect(adminLink.hidden).toBe(true);
  });

  it("#nav-admin is visible when state.role is 'admin'", async () => {
    const { checkAuthStatus } = await import("../src/ts/auth-guard");
    (checkAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      isAuthenticated: true,
      setupRequired: false,
      role: "admin",
    });

    const { applyNavVisibility } = await import("../src/ts/main");
    await applyNavVisibility();

    const adminLink = document.getElementById("nav-admin") as HTMLElement;
    expect(adminLink.hidden).toBe(false);
  });

  it("#nav-profile is always present for authenticated users", async () => {
    const { applyNavVisibility } = await import("../src/ts/main");
    await applyNavVisibility();

    const profileLink = document.getElementById("nav-profile");
    expect(profileLink).toBeTruthy();
  });
});
