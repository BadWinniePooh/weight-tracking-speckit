import { importCsvFile, ApiError, type ImportRowError } from "./api-client";

export function initImport(): void {
  const form = document.getElementById("import-form") as HTMLFormElement | null;
  const fileInput = document.getElementById("import-file-input") as HTMLInputElement | null;
  const feedback = document.getElementById("import-feedback");

  if (!form || !fileInput || !feedback) return;

  function setLoading(on: boolean): void {
    const btn = form!.querySelector<HTMLButtonElement>("button[type='submit']");
    if (!btn) return;
    btn.disabled = on;
    if (on) btn.classList.add("loading"); else btn.classList.remove("loading");
  }

  function renderResult(importedCount: number, failedCount: number, errors: ImportRowError[]): void {
    let html = `<div class="alert alert-success mt-3"><span>${importedCount} ${importedCount === 1 ? "entry" : "entries"} imported successfully.</span></div>`;

    if (failedCount > 0) {
      html += `
        <div class="alert alert-warning mt-2">
          <span>${failedCount} ${failedCount === 1 ? "row" : "rows"} could not be imported. Fix the issues below and re-upload if needed.</span>
        </div>
        <div class="overflow-x-auto mt-2">
          <table class="table table-sm w-full">
            <thead><tr><th>Row</th><th>Error</th></tr></thead>
            <tbody>
              ${errors.map((e) => `<tr><td>${e.row}</td><td>${escapeHtml(e.reason)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    }

    feedback!.innerHTML = html;
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedback.innerHTML = "";

    const file = fileInput.files?.[0];
    if (!file) {
      feedback.innerHTML = `<div class="alert alert-error mt-3"><span>Please select a CSV file to import.</span></div>`;
      return;
    }

    setLoading(true);
    try {
      const result = await importCsvFile(file);
      renderResult(result.importedCount, result.failedCount, result.errors);
      fileInput.value = "";
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      feedback.innerHTML = `<div class="alert alert-error mt-3"><span>${escapeHtml(message)}</span></div>`;
    } finally {
      setLoading(false);
    }
  });
}
