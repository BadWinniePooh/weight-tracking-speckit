import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import { setAccessToken } from "./auth-token";
import { loadConfig, getApiUrl } from "./config";
import { initTheme } from "./theme";

export async function initLoginPage(): Promise<void> {
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("login", state);

  const form = document.getElementById("login-form") as HTMLFormElement | null;
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = (document.getElementById("username") as HTMLInputElement).value.trim();
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const errorEl = document.getElementById("error-message");

    if (errorEl) errorEl.textContent = "";

    try {
      const response = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const { accessToken } = (await response.json()) as { accessToken: string };
        setAccessToken(accessToken);
        window.location.href = "/index.html";
        return;
      }

      if (response.status === 401) {
        if (errorEl) errorEl.textContent = "Invalid username or password.";
        return;
      }

      if (errorEl) errorEl.textContent = "Login failed. Please try again.";
    } catch {
      if (errorEl) errorEl.textContent = "Unable to reach server. Please try again.";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => void initLoginPage());
