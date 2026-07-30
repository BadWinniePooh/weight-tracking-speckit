import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../src/ts/auth-guard", () => ({
  checkAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: false, setupRequired: false }),
  enforceRedirect: vi.fn(),
}));

vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
  clearAccessToken: vi.fn(),
  getUserRole: vi.fn().mockReturnValue(null),
  getUserId: vi.fn().mockReturnValue(null),
}));

vi.mock("../src/ts/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ts/config")>();
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue(undefined),
    getApiUrl: vi.fn().mockReturnValue(""),
  };
});

vi.mock("../src/ts/api-client", () => ({
  resetPassword: vi.fn().mockResolvedValue(undefined),
  ApiError: class ApiError extends Error {
    status: number; field?: string;
    constructor(message: string, status: number, field?: string) {
      super(message); this.name = "ApiError"; this.status = status; this.field = field;
    }
  },
}));

function setSearch(search: string) {
  Object.defineProperty(window, "location", {
    value: { href: "", search },
    writable: true,
    configurable: true,
  });
}

describe("reset-complete page", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setSearch("?token=valid-token-123");
    document.body.innerHTML = `
      <form id="reset-complete-form">
        <input id="new-password-input" type="password" />
        <input id="confirm-password-input" type="password" />
        <button id="submit-btn" type="submit">Reset Password</button>
        <div id="feedback-msg"></div>
        <div id="token-error-msg" hidden></div>
      </form>
    `;
  });

  it("calls checkAuthStatus and enforceRedirect('public') on init", async () => {
    const { checkAuthStatus, enforceRedirect } = await import("../src/ts/auth-guard");
    const { initResetCompletePage } = await import("../src/ts/reset-complete");
    await initResetCompletePage();
    expect(checkAuthStatus).toHaveBeenCalled();
    expect(enforceRedirect).toHaveBeenCalledWith("public", expect.any(Object));
  });

  it("shows token-error-msg and disables submit when token is missing from URL", async () => {
    setSearch("");
    const { initResetCompletePage } = await import("../src/ts/reset-complete");
    await initResetCompletePage();

    const tokenErr = document.getElementById("token-error-msg") as HTMLElement;
    const btn = document.getElementById("submit-btn") as HTMLButtonElement;
    expect(tokenErr.classList.contains("hidden")).toBe(false);
    expect(btn.disabled).toBe(true);
  });

  it("shows error without API call when passwords do not match", async () => {
    const { resetPassword } = await import("../src/ts/api-client");
    const { initResetCompletePage } = await import("../src/ts/reset-complete");
    await initResetCompletePage();

    (document.getElementById("new-password-input") as HTMLInputElement).value = "abc123";
    (document.getElementById("confirm-password-input") as HTMLInputElement).value = "xyz999";
    document.getElementById("reset-complete-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    expect(resetPassword).not.toHaveBeenCalled();
    const feedback = document.getElementById("feedback-msg");
    expect(feedback?.textContent).toBeTruthy();
  });

  it("calls resetPassword with token and new password on valid submit", async () => {
    const { resetPassword } = await import("../src/ts/api-client");
    const { initResetCompletePage } = await import("../src/ts/reset-complete");
    await initResetCompletePage();

    (document.getElementById("new-password-input") as HTMLInputElement).value = "newpass123";
    (document.getElementById("confirm-password-input") as HTMLInputElement).value = "newpass123";
    document.getElementById("reset-complete-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    expect(resetPassword).toHaveBeenCalledWith("valid-token-123", "newpass123");
  });

  it("redirects to /login.html on success", async () => {
    vi.useFakeTimers();
    const { resetPassword } = await import("../src/ts/api-client");
    (resetPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const { initResetCompletePage } = await import("../src/ts/reset-complete");
    await initResetCompletePage();

    (document.getElementById("new-password-input") as HTMLInputElement).value = "newpass123";
    (document.getElementById("confirm-password-input") as HTMLInputElement).value = "newpass123";
    document.getElementById("reset-complete-form")!.dispatchEvent(new Event("submit"));
    // Flush microtasks so the async submit handler runs and the setTimeout is registered
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(2500);
    // Flush again so the redirect assignment executes
    await Promise.resolve();

    expect(window.location.href).toBe("/login.html");
  });

  it("shows error message on invalid/expired token (API error)", async () => {
    const { resetPassword } = await import("../src/ts/api-client");
    const { ApiError } = await import("../src/ts/api-client");
    (resetPassword as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError("This reset link is invalid or has expired.", 400)
    );
    const { initResetCompletePage } = await import("../src/ts/reset-complete");
    await initResetCompletePage();

    (document.getElementById("new-password-input") as HTMLInputElement).value = "newpass123";
    (document.getElementById("confirm-password-input") as HTMLInputElement).value = "newpass123";
    document.getElementById("reset-complete-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    const feedback = document.getElementById("feedback-msg");
    expect(feedback?.textContent).toContain("invalid or has expired");
  });
});
