import { getApiUrl } from "./config";
import { setAccessToken, getUserRole } from "./auth-token";
import {
  getAuthMarker,
  clearAuthMarker,
  isMarkerValid,
  recordSuccessfulAuth,
} from "./offline-store";

export interface AuthState {
  isAuthenticated: boolean;
  setupRequired: boolean;
  role?: string;
  /** True when auth was granted from the local marker because the server is unreachable. */
  offline?: boolean;
  error?: string;
}

/**
 * The network is unreachable. A valid local marker (written on the last
 * successful login/refresh, expiring 7 days out) lets the shell open in
 * offline mode; anything else falls through to the login redirect. The
 * marker gates only local UI — server data access still needs the cookie.
 */
function offlineState(): AuthState {
  if (isMarkerValid()) {
    const marker = getAuthMarker()!;
    return { isAuthenticated: true, setupRequired: false, role: marker.role, offline: true };
  }
  return { isAuthenticated: false, setupRequired: false, error: "Network error" };
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
    return offlineState();
  }

  try {
    const refreshRes = await fetch(`${getApiUrl()}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      const { accessToken } = (await refreshRes.json()) as { accessToken: string };
      setAccessToken(accessToken);
      recordSuccessfulAuth();
      const role = getUserRole() ?? undefined;
      return { isAuthenticated: true, setupRequired: false, role };
    }
    // The server answered and said no — the session is dead everywhere.
    clearAuthMarker();
  } catch {
    // Network dropped between the status check and the refresh.
    return offlineState();
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
