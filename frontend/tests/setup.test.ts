import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth-guard before importing setup
vi.mock("../src/ts/auth-guard", () => ({
  checkAuthStatus: vi.fn().mockResolvedValue({
    setupRequired: true,
    isAuthenticated: false,
  }),
  enforceRedirect: vi.fn(),
}));

vi.mock("../src/ts/config", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue(undefined),
    getApiUrl: vi.fn().mockReturnValue(""),
  };
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("setup form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <form id="setup-form">
        <input id="username" value="" />
        <input id="email" value="" />
        <input id="password" value="" />
        <input id="confirm-password" value="" />
        <button type="submit">Setup</button>
        <div id="error-message"></div>
      </form>
    `;
  });

  it("submits POST /api/setup/initialize with username, email, password on valid form", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ message: "Setup complete. Please log in." }),
    });

    const { initSetupPage } = await import("../src/ts/setup");

    const form = document.getElementById("setup-form") as HTMLFormElement;
    (document.getElementById("username") as HTMLInputElement).value = "admin";
    (document.getElementById("email") as HTMLInputElement).value = "admin@example.com";
    (document.getElementById("password") as HTMLInputElement).value = "password123";
    (document.getElementById("confirm-password") as HTMLInputElement).value = "password123";

    await initSetupPage();
    form.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/setup/initialize"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "admin", email: "admin@example.com", password: "password123" }),
      })
    );
  });

  it("shows error on 409 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Setup has already been completed." }),
    });

    const { initSetupPage } = await import("../src/ts/setup");
    await initSetupPage();

    (document.getElementById("username") as HTMLInputElement).value = "admin";
    (document.getElementById("email") as HTMLInputElement).value = "admin@example.com";
    (document.getElementById("password") as HTMLInputElement).value = "password123";
    (document.getElementById("confirm-password") as HTMLInputElement).value = "password123";

    const form = document.getElementById("setup-form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 10));

    const errEl = document.getElementById("error-message");
    expect(errEl?.textContent).toContain("Setup is already complete");
  });

  it("shows error when passwords do not match", async () => {
    const { initSetupPage } = await import("../src/ts/setup");
    await initSetupPage();

    (document.getElementById("username") as HTMLInputElement).value = "admin";
    (document.getElementById("email") as HTMLInputElement).value = "admin@example.com";
    (document.getElementById("password") as HTMLInputElement).value = "password123";
    (document.getElementById("confirm-password") as HTMLInputElement).value = "different456";

    const form = document.getElementById("setup-form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockFetch).not.toHaveBeenCalled();
    const errEl = document.getElementById("error-message");
    expect(errEl?.textContent).toContain("Passwords do not match");
  });
});
