import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import { requestPasswordReset } from "./api-client";
import { loadConfig } from "./config";
import { initTheme } from "./theme";

export async function initResetRequestPage(): Promise<void> {
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("public", state);

  const form = document.getElementById("reset-request-form") as HTMLFormElement | null;
  const emailInput = document.getElementById("email-input") as HTMLInputElement | null;
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;
  const feedbackEl = document.getElementById("feedback-msg");

  if (!form || !emailInput || !submitBtn || !feedbackEl) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    submitBtn.disabled = true;
    feedbackEl.textContent = "";

    try {
      await requestPasswordReset(email);
    } catch {
      // intentionally ignored — anti-enumeration: always show success
    }

    feedbackEl.textContent = "If an account with that email exists, a reset link has been sent.";
    submitBtn.disabled = false;
  });
}

document.addEventListener("DOMContentLoaded", () => void initResetRequestPage());
