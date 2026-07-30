import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/ts/auth-guard", () => ({
  checkAuthStatus: vi.fn().mockResolvedValue({
    setupRequired: false,
    isAuthenticated: false,
  }),
  enforceRedirect: vi.fn(),
}));

vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
  clearAccessToken: vi.fn(),
}));

vi.mock("../src/ts/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ts/config")>();
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue(undefined),
    getApiUrl: vi.fn().mockReturnValue(""),
  };
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("login form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <form id="login-form">
        <input id="username" value="" />
        <input id="password" value="" />
        <button type="submit">Login</button>
        <div id="error-message"></div>
      </form>
    `;
  });

  it("calls POST /api/auth/login on valid submit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "tok123", expiresIn: 900, tokenType: "Bearer" }),
    });

    const { initLoginPage } = await import("../src/ts/login");
    await initLoginPage();

    (document.getElementById("username") as HTMLInputElement).value = "admin";
    (document.getElementById("password") as HTMLInputElement).value = "password123";

    document.getElementById("login-form")!.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "password123" }),
      })
    );
  });

  it("calls setAccessToken and redirects to /index.html on 200 response", async () => {
    const { setAccessToken } = await import("../src/ts/auth-token");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "tok123", expiresIn: 900, tokenType: "Bearer" }),
    });

    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    const { initLoginPage } = await import("../src/ts/login");
    await initLoginPage();

    (document.getElementById("username") as HTMLInputElement).value = "admin";
    (document.getElementById("password") as HTMLInputElement).value = "password123";

    document.getElementById("login-form")!.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(setAccessToken).toHaveBeenCalledWith("tok123");
    expect(window.location.href).toBe("/index.html");
  });

  it("shows error message on 401 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid username or password." }),
    });

    const { initLoginPage } = await import("../src/ts/login");
    await initLoginPage();

    (document.getElementById("username") as HTMLInputElement).value = "admin";
    (document.getElementById("password") as HTMLInputElement).value = "wrongpass";

    document.getElementById("login-form")!.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 10));

    const errEl = document.getElementById("error-message");
    expect(errEl?.textContent).toContain("Invalid username or password.");
  });

  it("shows server error message on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { initLoginPage } = await import("../src/ts/login");
    await initLoginPage();

    (document.getElementById("username") as HTMLInputElement).value = "admin";
    (document.getElementById("password") as HTMLInputElement).value = "password123";

    document.getElementById("login-form")!.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 10));

    const errEl = document.getElementById("error-message");
    expect(errEl?.textContent).toContain("Unable to reach server");
  });
});
