import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import { resetPassword, ApiError } from "./api-client";
import { loadConfig } from "./config";
import { initTheme } from "./theme";

export async function initResetCompletePage(): Promise<void> {
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("public", state);

  const form = document.getElementById("reset-complete-form") as HTMLFormElement | null;
  const newPasswordInput = document.getElementById("new-password-input") as HTMLInputElement | null;
  const confirmPasswordInput = document.getElementById("confirm-password-input") as HTMLInputElement | null;
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;
  const feedbackEl = document.getElementById("feedback-msg");
  const tokenErrorEl = document.getElementById("token-error-msg") as HTMLElement | null;

  if (!form || !newPasswordInput || !confirmPasswordInput || !submitBtn || !feedbackEl) return;

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    if (tokenErrorEl) tokenErrorEl.hidden = false;
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedbackEl.textContent = "";

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword !== confirmPassword) {
      feedbackEl.textContent = "Passwords do not match.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.dataset.loading = "true";
    submitBtn.classList.add("loading");
    try {
      await resetPassword(token, newPassword);
      window.location.href = "/login.html";
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.dataset.loading = "false";
      submitBtn.classList.remove("loading");
      if (err instanceof ApiError) {
        feedbackEl.textContent = err.message;
      } else {
        feedbackEl.textContent = "Something went wrong. Please try again.";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => void initResetCompletePage());
