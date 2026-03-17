import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/ts/auth-guard", () => ({
  checkAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true, setupRequired: false, role: "user" }),
  enforceRedirect: vi.fn(),
}));

const mockClearAccessToken = vi.fn();
vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue("mock-token"),
  clearAccessToken: mockClearAccessToken,
  getUserRole: vi.fn().mockReturnValue("user"),
  getUserId: vi.fn().mockReturnValue("user-id-123"),
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
  getMe: vi.fn().mockResolvedValue({ id: "user-id-123", username: "testuser", email: "testuser@example.com", role: "user" }),
  changeUsername: vi.fn().mockResolvedValue({ username: "newuser" }),
  changeEmail: vi.fn().mockResolvedValue({ message: "Confirmation sent." }),
  changePassword: vi.fn().mockResolvedValue(undefined),
  ApiError: class ApiError extends Error {
    status: number; field?: string;
    constructor(message: string, status: number, field?: string) {
      super(message); this.name = "ApiError"; this.status = status; this.field = field;
    }
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function setupDom() {
  document.body.innerHTML = `
    <button id="logout-button">Log out</button>
    <form id="username-form">
      <input id="username-input" type="text" />
      <div id="username-feedback"></div>
      <button type="submit">Change Username</button>
    </form>
    <form id="email-form">
      <input id="email-input" type="email" />
      <div id="email-feedback"></div>
      <button type="submit">Change Email</button>
    </form>
    <form id="password-form">
      <input id="current-password-input" type="password" />
      <input id="new-password-input" type="password" />
      <input id="confirm-password-input" type="password" />
      <div id="password-feedback"></div>
      <button type="submit">Change Password</button>
    </form>
  `;
}

describe("profile page — logout button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    mockFetch.mockResolvedValue({ ok: true, status: 204 });
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  it("calls POST /api/auth/logout and redirects to /login.html on logout click", async () => {
    const { initProfilePage } = await import("../src/ts/profile");
    await initProfilePage();

    document.getElementById("logout-button")!.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/logout"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(mockClearAccessToken).toHaveBeenCalled();
    expect(window.location.href).toBe("/login.html");
  });
});

describe("profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
  });

  it("calls checkAuthStatus and enforceRedirect('profile') on init", async () => {
    const { checkAuthStatus, enforceRedirect } = await import("../src/ts/auth-guard");
    const { initProfilePage } = await import("../src/ts/profile");
    await initProfilePage();
    expect(checkAuthStatus).toHaveBeenCalled();
    expect(enforceRedirect).toHaveBeenCalledWith("profile", expect.any(Object));
  });

  it("calls changeUsername and shows username-feedback on submit", async () => {
    const { changeUsername } = await import("../src/ts/api-client");
    const { initProfilePage } = await import("../src/ts/profile");
    await initProfilePage();

    (document.getElementById("username-input") as HTMLInputElement).value = "newusername";
    document.getElementById("username-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    expect(changeUsername).toHaveBeenCalledWith("newusername");
    const feedback = document.getElementById("username-feedback");
    expect(feedback?.textContent).toBeTruthy();
  });

  it("calls changeEmail and shows confirmation notice in email-feedback", async () => {
    const { changeEmail } = await import("../src/ts/api-client");
    const { initProfilePage } = await import("../src/ts/profile");
    await initProfilePage();

    (document.getElementById("email-input") as HTMLInputElement).value = "new@example.com";
    document.getElementById("email-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    expect(changeEmail).toHaveBeenCalledWith("new@example.com");
    const feedback = document.getElementById("email-feedback");
    expect(feedback?.textContent).toContain("confirmation");
  });

  it("shows error without API call when new and confirm passwords do not match", async () => {
    const { changePassword } = await import("../src/ts/api-client");
    const { initProfilePage } = await import("../src/ts/profile");
    await initProfilePage();

    (document.getElementById("current-password-input") as HTMLInputElement).value = "current";
    (document.getElementById("new-password-input") as HTMLInputElement).value = "newpass";
    (document.getElementById("confirm-password-input") as HTMLInputElement).value = "different";
    document.getElementById("password-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    expect(changePassword).not.toHaveBeenCalled();
    const feedback = document.getElementById("password-feedback");
    expect(feedback?.textContent).toBeTruthy();
  });

  it("calls changePassword with currentPassword and newPassword on valid submit", async () => {
    const { changePassword } = await import("../src/ts/api-client");
    const { initProfilePage } = await import("../src/ts/profile");
    await initProfilePage();

    (document.getElementById("current-password-input") as HTMLInputElement).value = "oldpass";
    (document.getElementById("new-password-input") as HTMLInputElement).value = "newpass123";
    (document.getElementById("confirm-password-input") as HTMLInputElement).value = "newpass123";
    document.getElementById("password-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    expect(changePassword).toHaveBeenCalledWith("oldpass", "newpass123");
  });

  it("shows inline error in password-feedback on API error", async () => {
    const { changePassword, ApiError } = await import("../src/ts/api-client");
    (changePassword as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError("Incorrect current password.", 400)
    );
    const { initProfilePage } = await import("../src/ts/profile");
    await initProfilePage();

    (document.getElementById("current-password-input") as HTMLInputElement).value = "wrong";
    (document.getElementById("new-password-input") as HTMLInputElement).value = "newpass123";
    (document.getElementById("confirm-password-input") as HTMLInputElement).value = "newpass123";
    document.getElementById("password-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    const feedback = document.getElementById("password-feedback");
    expect(feedback?.textContent).toContain("Incorrect");
  });
});

describe("profile page — email change notice (FR-031)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
  });

  it("email change confirmation notice contains the actual new email address", async () => {
    const { initProfilePage } = await import("../src/ts/profile");
    await initProfilePage();

    (document.getElementById("email-input") as HTMLInputElement).value = "new@example.com";
    document.getElementById("email-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    const feedback = document.getElementById("email-feedback");
    expect(feedback?.textContent).toContain("new@example.com");
  });
});
