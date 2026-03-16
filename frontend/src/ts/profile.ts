import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import { changeUsername, changeEmail, changePassword, ApiError } from "./api-client";
import { loadConfig } from "./config";
import { initNavbar } from "./navbar";
import { initTheme } from "./theme";

export async function initProfilePage(): Promise<void> {
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("profile", state);
  initNavbar("profile");

  // Change username
  const usernameForm = document.getElementById("username-form") as HTMLFormElement | null;
  const usernameInput = document.getElementById("username-input") as HTMLInputElement | null;
  const usernameFeedback = document.getElementById("username-feedback");

  function setLoading(form: HTMLFormElement, on: boolean): void {
    const btn = form.querySelector<HTMLButtonElement>("button[type='submit']");
    if (!btn) return;
    btn.disabled = on;
    btn.dataset.loading = on ? "true" : "false";
    if (on) btn.classList.add("loading"); else btn.classList.remove("loading");
  }

  if (usernameForm && usernameInput && usernameFeedback) {
    usernameForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      usernameFeedback.textContent = "";
      setLoading(usernameForm, true);
      try {
        const result = await changeUsername(usernameInput.value.trim());
        usernameFeedback.textContent = `Username changed to ${result.username}.`;
      } catch (err) {
        if (err instanceof ApiError) {
          usernameFeedback.textContent = err.message;
        } else {
          usernameFeedback.textContent = "Something went wrong. Please try again.";
        }
      } finally {
        setLoading(usernameForm, false);
      }
    });
  }

  // Change email
  const emailForm = document.getElementById("email-form") as HTMLFormElement | null;
  const emailInput = document.getElementById("email-input") as HTMLInputElement | null;
  const emailFeedback = document.getElementById("email-feedback");

  if (emailForm && emailInput && emailFeedback) {
    emailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      emailFeedback.textContent = "";
      setLoading(emailForm, true);
      try {
        const newEmail = emailInput.value.trim();
        await changeEmail(newEmail);
        emailFeedback.textContent = `A confirmation email has been sent to ${newEmail}. Your current email remains active until you confirm.`;
      } catch (err) {
        if (err instanceof ApiError) {
          emailFeedback.textContent = err.message;
        } else {
          emailFeedback.textContent = "Something went wrong. Please try again.";
        }
      } finally {
        setLoading(emailForm, false);
      }
    });
  }

  // Change password
  const passwordForm = document.getElementById("password-form") as HTMLFormElement | null;
  const currentPasswordInput = document.getElementById("current-password-input") as HTMLInputElement | null;
  const newPasswordInput = document.getElementById("new-password-input") as HTMLInputElement | null;
  const confirmPasswordInput = document.getElementById("confirm-password-input") as HTMLInputElement | null;
  const passwordFeedback = document.getElementById("password-feedback");

  if (passwordForm && currentPasswordInput && newPasswordInput && confirmPasswordInput && passwordFeedback) {
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      passwordFeedback.textContent = "";

      if (newPasswordInput.value !== confirmPasswordInput.value) {
        passwordFeedback.textContent = "New passwords do not match.";
        return;
      }

      setLoading(passwordForm, true);
      try {
        await changePassword(currentPasswordInput.value, newPasswordInput.value);
        passwordFeedback.textContent = "Password changed successfully.";
      } catch (err) {
        if (err instanceof ApiError) {
          passwordFeedback.textContent = err.message;
        } else {
          passwordFeedback.textContent = "Something went wrong. Please try again.";
        }
      } finally {
        setLoading(passwordForm, false);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => void initProfilePage());
