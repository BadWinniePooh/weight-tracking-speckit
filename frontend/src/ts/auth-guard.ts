import { getApiUrl } from "./config";
import { setAccessToken, getUserRole } from "./auth-token";

export interface AuthState {
  isAuthenticated: boolean;
  setupRequired: boolean;
  role?: string;
  error?: string;
}

export async function checkAuthStatus(): Promise<AuthState> {
  try {
    const statusRes = await fetch(`${getApiUrl()}/api/setup/status`);
    if (statusRes.ok) {
      const { firstRun } = (await statusRes.json()) as { firstRun: boolean };
      if (firstRun) {
        return { isAuthenticated: false, setupRequired: true };
      }
    }
  } catch {
    return { isAuthenticated: false, setupRequired: false, error: "Network error" };
  }

  try {
    const refreshRes = await fetch(`${getApiUrl()}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      const { accessToken } = (await refreshRes.json()) as { accessToken: string };
      setAccessToken(accessToken);
      const role = getUserRole() ?? undefined;
      return { isAuthenticated: true, setupRequired: false, role };
    }
  } catch {
    // refresh failed — unauthenticated
  }

  return { isAuthenticated: false, setupRequired: false };
}

export function enforceRedirect(
  pageType: "app" | "login" | "setup" | "profile" | "admin" | "public",
  state: AuthState
): void {
  if (pageType === "app") {
    if (!state.isAuthenticated && !state.setupRequired) {
      window.location.href = "/login.html";
    } else if (!state.isAuthenticated && state.setupRequired) {
      window.location.href = "/setup.html";
    }
  } else if (pageType === "login") {
    if (state.isAuthenticated) {
      window.location.href = "/index.html";
    } else if (state.setupRequired) {
      window.location.href = "/setup.html";
    }
  } else if (pageType === "setup") {
    if (state.isAuthenticated) {
      window.location.href = "/index.html";
    } else if (!state.setupRequired) {
      window.location.href = "/login.html";
    }
  } else if (pageType === "profile") {
    if (!state.isAuthenticated) {
      window.location.href = "/login.html";
    }
  } else if (pageType === "admin") {
    if (!state.isAuthenticated) {
      window.location.href = "/login.html";
    } else if (state.role !== "admin") {
      window.location.href = "/index.html";
    }
  }
  // "public" — no redirect
}
