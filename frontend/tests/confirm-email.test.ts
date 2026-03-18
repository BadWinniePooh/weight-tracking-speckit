import { describe, it, expect, vi, beforeEach } from "vitest";

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
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue(undefined),
    getApiUrl: vi.fn().mockReturnValue(""),
  };
});

vi.mock("../src/ts/api-client", () => ({
  confirmEmail: vi.fn().mockResolvedValue({ message: "Email confirmed.", passwordResetToken: "test-reset-token" }),
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

describe("confirm-email page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearch("?token=valid-token-abc");
    document.body.innerHTML = `
      <div id="loading-panel" class="hidden"></div>
      <div id="success-panel" class="hidden">
        <a id="setup-password-link" href="#">Set Up Password</a>
      </div>
      <div id="error-panel" class="hidden">
        <span id="error-message"></span>
        <a href="/login.html">Back to Sign In</a>
        <a href="mailto:support@example.com">Contact Support</a>
      </div>
    `;
  });

  it("calls checkAuthStatus and enforceRedirect('public') on init", async () => {
    const { checkAuthStatus, enforceRedirect } = await import("../src/ts/auth-guard");
    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    await initConfirmEmailPage();
    expect(checkAuthStatus).toHaveBeenCalled();
    expect(enforceRedirect).toHaveBeenCalledWith("public", expect.any(Object));
  });

  it("shows error-panel immediately when no token in URL, without calling confirmEmail", async () => {
    setSearch("");
    const { confirmEmail } = await import("../src/ts/api-client");
    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    await initConfirmEmailPage();

    const errorPanel = document.getElementById("error-panel")!;
    expect(errorPanel.classList.contains("hidden")).toBe(false);
    expect(confirmEmail).not.toHaveBeenCalled();
  });

  it("shows error-panel immediately when token is empty string, without calling confirmEmail", async () => {
    setSearch("?token=");
    const { confirmEmail } = await import("../src/ts/api-client");
    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    await initConfirmEmailPage();

    const errorPanel = document.getElementById("error-panel")!;
    expect(errorPanel.classList.contains("hidden")).toBe(false);
    expect(confirmEmail).not.toHaveBeenCalled();
  });

  it("shows loading-panel while request is in flight", async () => {
    let resolveConfirm!: () => void;
    const { confirmEmail } = await import("../src/ts/api-client");
    (confirmEmail as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveConfirm = resolve; })
    );

    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    const initPromise = initConfirmEmailPage();

    // Flush microtasks so the awaited init calls (loadConfig, checkAuthStatus) complete
    // before the loading-panel show and the pending confirmEmail await
    await Promise.resolve();
    await Promise.resolve();

    const loadingPanel = document.getElementById("loading-panel")!;
    expect(loadingPanel.classList.contains("hidden")).toBe(false);

    resolveConfirm();
    await initPromise;
  });

  it("shows success-panel and hides loading-panel after successful confirmation", async () => {
    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    await initConfirmEmailPage();

    const loadingPanel = document.getElementById("loading-panel")!;
    const successPanel = document.getElementById("success-panel")!;
    expect(loadingPanel.classList.contains("hidden")).toBe(true);
    expect(successPanel.classList.contains("hidden")).toBe(false);
  });

  it("success-panel contains a link to /reset-complete.html?token=<passwordResetToken>", async () => {
    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    await initConfirmEmailPage();

    const successPanel = document.getElementById("success-panel")!;
    const setupLink = successPanel.querySelector<HTMLAnchorElement>("#setup-password-link");
    expect(setupLink).not.toBeNull();
    expect(setupLink!.href).toContain("/reset-complete.html?token=");
    expect(setupLink!.href).toContain("test-reset-token");
  });

  it("shows error-panel and hides loading-panel after API error", async () => {
    const { confirmEmail, ApiError } = await import("../src/ts/api-client");
    (confirmEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError("This confirmation link is invalid or has expired.", 400)
    );
    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    await initConfirmEmailPage();

    const loadingPanel = document.getElementById("loading-panel")!;
    const errorPanel = document.getElementById("error-panel")!;
    expect(loadingPanel.classList.contains("hidden")).toBe(true);
    expect(errorPanel.classList.contains("hidden")).toBe(false);
  });

  it("error-panel contains a link to /login.html after API error", async () => {
    const { confirmEmail, ApiError } = await import("../src/ts/api-client");
    (confirmEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError("Invalid token.", 400)
    );
    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    await initConfirmEmailPage();

    const errorPanel = document.getElementById("error-panel")!;
    const loginLink = errorPanel.querySelector<HTMLAnchorElement>("a[href='/login.html']");
    expect(loginLink).not.toBeNull();
  });

  it("error-panel contains a mailto: contact-support link after API error", async () => {
    const { confirmEmail, ApiError } = await import("../src/ts/api-client");
    (confirmEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError("Invalid token.", 400)
    );
    const { initConfirmEmailPage } = await import("../src/ts/confirm-email");
    await initConfirmEmailPage();

    const errorPanel = document.getElementById("error-panel")!;
    const supportLink = errorPanel.querySelector<HTMLAnchorElement>("a[href^='mailto:']");
    expect(supportLink).not.toBeNull();
  });
});
