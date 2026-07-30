import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import { confirmEmail, ApiError } from "./api-client";
import { loadConfig } from "./config";
import { initTheme } from "./theme";

export async function initConfirmEmailPage(): Promise<void> {
  // T005 [US1+US4]: Auth init — enforceRedirect("public") redirects authenticated users to app
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("public", state);

  const loadingPanel = document.getElementById("loading-panel");
  const successPanel = document.getElementById("success-panel");
  const errorPanel = document.getElementById("error-panel");
  const errorMessageEl = document.getElementById("error-message");

  // T009 [US3]: Missing or empty token — immediate error, no API call
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    errorPanel?.classList.remove("hidden");
    if (errorMessageEl) {
      errorMessageEl.textContent =
        "This confirmation link is missing or invalid. Please use the link from your email.";
    }
    return;
  }

  // T006 [US1]: Show loading panel, call API
  loadingPanel?.classList.remove("hidden");
  try {
    const response = await confirmEmail(token);
    loadingPanel?.classList.add("hidden");
    if (!response.passwordResetToken) {
      // FR-006: missing token treated as error
      errorPanel?.classList.remove("hidden");
      if (errorMessageEl) {
        errorMessageEl.textContent =
          "Email confirmed but setup link could not be generated. Please contact support.";
      }
      return;
    }
    const setupLink = document.getElementById("setup-password-link") as HTMLAnchorElement | null;
    if (setupLink) {
      setupLink.href = `/reset-complete.html?token=${encodeURIComponent(response.passwordResetToken)}`;
    }
    successPanel?.classList.remove("hidden");
  } catch (err) {
    // T008 [US2]: API error — hide loading, show error panel
    loadingPanel?.classList.add("hidden");
    errorPanel?.classList.remove("hidden");
    if (errorMessageEl) {
      errorMessageEl.textContent =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => void initConfirmEmailPage());
