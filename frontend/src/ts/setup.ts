import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import { loadConfig, getApiUrl } from "./config";
import { initTheme } from "./theme";

export async function initSetupPage(): Promise<void> {
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("setup", state);

  const form = document.getElementById("setup-form") as HTMLFormElement | null;
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = (document.getElementById("username") as HTMLInputElement).value.trim();
    const email = (document.getElementById("email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const confirmPassword = (document.getElementById("confirm-password") as HTMLInputElement).value;
    const errorEl = document.getElementById("error-message");
    const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");

    if (errorEl) errorEl.textContent = "";

    if (password !== confirmPassword) {
      if (errorEl) errorEl.textContent = "Passwords do not match.";
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.loading = "true"; submitBtn.classList.add("loading"); }

    try {
      const response = await fetch(`${getApiUrl()}/api/setup/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (response.status === 201) {
        window.location.href = "/login.html";
        return;
      }

      const body = await response.json() as { error?: string; errors?: Record<string, string[]> };

      if (response.status === 409) {
        if (errorEl) errorEl.textContent = "Setup is already complete. Please log in.";
        return;
      }

      if (response.status === 400) {
        if (body.errors) {
          const messages = Object.values(body.errors).flat().join(" ");
          if (errorEl) errorEl.textContent = messages;
        } else {
          if (errorEl) errorEl.textContent = body.error ?? "Validation error.";
        }
        return;
      }

      if (errorEl) errorEl.textContent = "Setup failed. Please try again.";
    } catch {
      if (errorEl) errorEl.textContent = "Unable to reach server. Please try again.";
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.dataset.loading = "false"; submitBtn.classList.remove("loading"); }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => void initSetupPage());
