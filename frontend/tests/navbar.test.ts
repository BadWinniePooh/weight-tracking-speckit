import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth-token to control the role
vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
  clearAccessToken: vi.fn(),
  getUserRole: vi.fn().mockReturnValue("user"),
  getUserId: vi.fn().mockReturnValue(null),
}));

function setupNavbarDom() {
  document.body.innerHTML = `
    <nav id="main-navbar" class="navbar bg-base-100 shadow-sm">
      <div class="navbar-start">
        <a id="nav-brand" href="/index.html">Weight Tracker</a>
      </div>
      <div class="navbar-center hidden lg:flex">
        <ul id="nav-links-desktop" class="menu menu-horizontal px-1">
          <li><a id="nav-dashboard" href="/index.html">Dashboard</a></li>
          <li><a id="nav-profile" href="/profile.html">Profile</a></li>
          <li><a id="nav-admin" href="/admin.html" hidden>Admin Dashboard</a></li>
        </ul>
      </div>
      <div class="navbar-end">
        <button id="logout-button" class="btn btn-ghost">Log out</button>
        <button id="nav-hamburger" class="btn btn-ghost lg:hidden" type="button" aria-label="Open navigation menu">☰</button>
      </div>
    </nav>
    <div id="nav-mobile-menu" class="lg:hidden" hidden>
      <ul id="nav-links-mobile" class="menu menu-vertical px-1 bg-base-100 shadow-sm">
        <li><a id="nav-mobile-dashboard" href="/index.html">Dashboard</a></li>
        <li><a id="nav-mobile-profile" href="/profile.html">Profile</a></li>
        <li><a id="nav-mobile-admin" href="/admin.html" hidden>Admin Dashboard</a></li>
        <li><button id="nav-mobile-logout" type="button">Log out</button></li>
      </ul>
    </div>
  `;
}

describe("navbar — role-based visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavbarDom();
  });

  it("hides #nav-admin and #nav-mobile-admin when role is 'user'", async () => {
    const { getUserRole } = await import("../src/ts/auth-token");
    (getUserRole as ReturnType<typeof vi.fn>).mockReturnValue("user");

    const { initNavbar } = await import("../src/ts/navbar");
    initNavbar("dashboard");

    const navAdmin = document.getElementById("nav-admin");
    const navMobileAdmin = document.getElementById("nav-mobile-admin");
    expect(navAdmin?.hidden).toBe(true);
    expect(navMobileAdmin?.hidden).toBe(true);
  });

  it("shows #nav-admin and #nav-mobile-admin when role is 'admin'", async () => {
    const { getUserRole } = await import("../src/ts/auth-token");
    (getUserRole as ReturnType<typeof vi.fn>).mockReturnValue("admin");

    const { initNavbar } = await import("../src/ts/navbar");
    initNavbar("dashboard");

    const navAdmin = document.getElementById("nav-admin");
    const navMobileAdmin = document.getElementById("nav-mobile-admin");
    expect(navAdmin?.hidden).toBe(false);
    expect(navMobileAdmin?.hidden).toBe(false);
  });
});

describe("navbar — active page indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavbarDom();
  });

  it("sets aria-current='page' on #nav-dashboard when activePage is 'dashboard'", async () => {
    const { getUserRole } = await import("../src/ts/auth-token");
    (getUserRole as ReturnType<typeof vi.fn>).mockReturnValue("user");

    const { initNavbar } = await import("../src/ts/navbar");
    initNavbar("dashboard");

    const navDashboard = document.getElementById("nav-dashboard");
    expect(navDashboard?.getAttribute("aria-current")).toBe("page");
  });

  it("sets aria-current='page' on #nav-profile when activePage is 'profile'", async () => {
    const { getUserRole } = await import("../src/ts/auth-token");
    (getUserRole as ReturnType<typeof vi.fn>).mockReturnValue("user");

    const { initNavbar } = await import("../src/ts/navbar");
    initNavbar("profile");

    const navProfile = document.getElementById("nav-profile");
    expect(navProfile?.getAttribute("aria-current")).toBe("page");
  });
});

describe("navbar — hamburger toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavbarDom();
  });

  it("removes hidden from #nav-mobile-menu when hamburger is clicked", async () => {
    const { getUserRole } = await import("../src/ts/auth-token");
    (getUserRole as ReturnType<typeof vi.fn>).mockReturnValue("user");

    const { initNavbar } = await import("../src/ts/navbar");
    initNavbar("dashboard");

    const hamburger = document.getElementById("nav-hamburger")!;
    const mobileMenu = document.getElementById("nav-mobile-menu")!;

    expect(mobileMenu.hidden).toBe(true);
    hamburger.click();
    expect(mobileMenu.hidden).toBe(false);
  });

  it("adds hidden back to #nav-mobile-menu when hamburger is clicked a second time", async () => {
    const { getUserRole } = await import("../src/ts/auth-token");
    (getUserRole as ReturnType<typeof vi.fn>).mockReturnValue("user");

    const { initNavbar } = await import("../src/ts/navbar");
    initNavbar("dashboard");

    const hamburger = document.getElementById("nav-hamburger")!;
    const mobileMenu = document.getElementById("nav-mobile-menu")!;

    hamburger.click();
    expect(mobileMenu.hidden).toBe(false);
    hamburger.click();
    expect(mobileMenu.hidden).toBe(true);
  });
});
