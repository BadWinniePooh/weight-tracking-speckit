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
  const successPanel = document.getElementById("success-panel");
  const sendAgainBtn = document.getElementById("send-again-btn");

  if (!form || !emailInput || !submitBtn || !feedbackEl) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    submitBtn.disabled = true;
    submitBtn.dataset.loading = "true";
    submitBtn.classList.add("loading");
    feedbackEl.textContent = "";

    try {
      await requestPasswordReset(email);
    } catch {
      // intentionally ignored — anti-enumeration: always show success
    }

    submitBtn.dataset.loading = "false";
    submitBtn.classList.remove("loading");
    form.classList.add("hidden");
    successPanel?.classList.remove("hidden");
  });

  sendAgainBtn?.addEventListener("click", () => {
    successPanel?.classList.add("hidden");
    form.classList.remove("hidden");
    emailInput.value = "";
  });
}

document.addEventListener("DOMContentLoaded", () => void initResetRequestPage());
