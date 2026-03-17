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
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
}));

describe("reset-request page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <form id="reset-request-form">
        <input id="email-input" type="email" />
        <button id="submit-btn" type="submit">Send Reset Link</button>
        <div id="feedback-msg"></div>
      </form>
      <div id="success-panel" class="hidden"></div>
    `;
  });

  it("calls checkAuthStatus and enforceRedirect('public') on init", async () => {
    const { checkAuthStatus, enforceRedirect } = await import("../src/ts/auth-guard");
    const { initResetRequestPage } = await import("../src/ts/reset-request");
    await initResetRequestPage();
    expect(checkAuthStatus).toHaveBeenCalled();
    expect(enforceRedirect).toHaveBeenCalledWith("public", expect.any(Object));
  });

  it("calls requestPasswordReset with email on submit", async () => {
    const { requestPasswordReset } = await import("../src/ts/api-client");
    const { initResetRequestPage } = await import("../src/ts/reset-request");
    await initResetRequestPage();

    (document.getElementById("email-input") as HTMLInputElement).value = "user@example.com";
    document.getElementById("reset-request-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    expect(requestPasswordReset).toHaveBeenCalledWith("user@example.com");
  });

  it("always shows success message regardless of API result (anti-enumeration)", async () => {
    const { requestPasswordReset } = await import("../src/ts/api-client");
    (requestPasswordReset as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    const { initResetRequestPage } = await import("../src/ts/reset-request");
    await initResetRequestPage();

    (document.getElementById("email-input") as HTMLInputElement).value = "anyone@example.com";
    document.getElementById("reset-request-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    const successPanel = document.getElementById("success-panel");
    expect(successPanel?.classList.contains("hidden")).toBe(false);
  });

  it("disables submit button during in-flight request", async () => {
    let resolveRequest!: () => void;
    const { requestPasswordReset } = await import("../src/ts/api-client");
    (requestPasswordReset as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise((res) => { resolveRequest = res; })
    );

    const { initResetRequestPage } = await import("../src/ts/reset-request");
    await initResetRequestPage();

    const btn = document.getElementById("submit-btn") as HTMLButtonElement;
    (document.getElementById("email-input") as HTMLInputElement).value = "test@example.com";
    document.getElementById("reset-request-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 0));

    expect(btn.disabled).toBe(true);
    resolveRequest();
    await new Promise((r) => setTimeout(r, 10));
    expect(btn.disabled).toBe(true);
  });
});
