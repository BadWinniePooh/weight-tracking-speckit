import { getUserRole, clearAccessToken, getAccessToken } from "./auth-token";
import { clearAuthMarker } from "./offline-store";
import { getApiUrl } from "./config";

export function initNavbar(activePage: "dashboard" | "profile" | "admin"): void {
  // Role-based link visibility
  const role = getUserRole() ?? "user";
  const isAdmin = role === "admin";

  const navAdmin = document.getElementById("nav-admin");
  const navMobileAdmin = document.getElementById("nav-mobile-admin");
  if (navAdmin) navAdmin.hidden = !isAdmin;
  if (navMobileAdmin) navMobileAdmin.hidden = !isAdmin;

  // Active page indicator — desktop
  const pageToId: Record<string, string> = {
    dashboard: "nav-dashboard",
    profile: "nav-profile",
    admin: "nav-admin",
  };
  // Active page indicator — mobile
  const mobilePageToId: Record<string, string> = {
    dashboard: "nav-mobile-dashboard",
    profile: "nav-mobile-profile",
    admin: "nav-mobile-admin",
  };

  const activeDesktopEl = document.getElementById(pageToId[activePage]);
  if (activeDesktopEl) activeDesktopEl.setAttribute("aria-current", "page");

  const activeMobileEl = document.getElementById(mobilePageToId[activePage]);
  if (activeMobileEl) activeMobileEl.setAttribute("aria-current", "page");

  // Hamburger toggle
  const hamburger = document.getElementById("nav-hamburger");
  const mobileMenu = document.getElementById("nav-mobile-menu");
  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", () => {
      mobileMenu.hidden = !mobileMenu.hidden;
    });
  }

  // Logout buttons (desktop + mobile)
  async function handleLogout(): Promise<void> {
    try {
      const headers = new Headers();
      const token = getAccessToken();
      if (token) {
        headers.append("Authorization", `Bearer ${token}`);
      }
      await fetch(`${getApiUrl()}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers,
      });
    } catch {
      // always clear session regardless of server response
    } finally {
      clearAccessToken();
      clearAuthMarker();
      window.location.href = "/login.html";
    }
  }

  document.getElementById("logout-button")?.addEventListener("click", handleLogout);
  document.getElementById("nav-mobile-logout")?.addEventListener("click", handleLogout);
}
