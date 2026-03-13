import type { WeightEntry } from "./model";

export function generateCSV(entries: WeightEntry[]): string {
  const header = "date,time,weight,unit\n";
  if (entries.length === 0) {
    return header;
  }
  const rows = entries.map((entry) => {
    const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
    const time = entry.timestamp.slice(11, 16); // HH:MM
    return `${date},${time},${entry.weightValue},${entry.unit}`;
  });
  return header + rows.join("\n") + "\n";
}

export function generateJSON(entries: WeightEntry[]): string {
  return JSON.stringify(entries);
}

export function formatExportFilename(format: "csv" | "json"): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `weight-entries-${year}-${month}-${day}.${format}`;
}

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
