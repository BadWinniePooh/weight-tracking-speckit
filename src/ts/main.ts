import { loadEntries, isDataCorrupt } from "./storage";
import { getUnit, setUnit } from "./preferences";
import { renderApp, renderEntryList, handleSubmit, handleDelete, initEntries } from "./ui";
import { generateCSV, generateJSON, formatExportFilename, triggerDownload } from "./export";
import type { WeightUnit } from "./model";

document.addEventListener("DOMContentLoaded", () => {
  const entries = loadEntries();
  const corrupt = isDataCorrupt();

  renderApp(corrupt);

  if (corrupt) return;

  initEntries(entries);

  // Set unit selector to persisted preference
  const unit = getUnit();
  const unitSelect = document.getElementById("unit-select") as HTMLSelectElement | null;
  if (unitSelect) unitSelect.value = unit;

  renderEntryList(entries);

  // Unit preference change
  unitSelect?.addEventListener("change", () => {
    setUnit(unitSelect.value as WeightUnit);
  });

  // Submit button click
  const submitBtn = document.getElementById("submit-btn");
  submitBtn?.addEventListener("click", (e) => handleSubmit(e));

  // Enter key in weight input
  const weightInput = document.getElementById("weight-input");
  weightInput?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      handleSubmit(e);
    }
  });

  // Click delegation for delete buttons
  const entryList = document.getElementById("entry-list");
  entryList?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute("data-action") === "delete") {
      const id = target.getAttribute("data-id");
      if (id) handleDelete(id);
    }
  });

  // Export button
  const exportBtn = document.getElementById("export-btn");
  exportBtn?.addEventListener("click", () => {
    const formatSelect = document.getElementById("export-format") as HTMLSelectElement | null;
    const format = (formatSelect?.value ?? "csv") as "csv" | "json";
    const currentEntries = loadEntries();

    if (format === "csv") {
      const content = generateCSV(currentEntries);
      triggerDownload(content, formatExportFilename("csv"), "text/csv");
    } else {
      const content = generateJSON(currentEntries);
      triggerDownload(content, formatExportFilename("json"), "application/json");
    }
  });
});
