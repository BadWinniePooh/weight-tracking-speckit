import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCSV, generateJSON, formatExportFilename, triggerDownload } from "../src/ts/export";
import type { WeightEntry } from "../src/ts/model";

function makeEntry(overrides: Partial<WeightEntry> = {}): WeightEntry {
  return {
    id: "e1",
    weightValue: 82.5,
    unit: "kg",
    timestamp: "2026-03-13T09:15:00.000Z",
    ...overrides,
  };
}

describe("generateCSV", () => {
  it("returns header row only for empty array", () => {
    const result = generateCSV([]);
    expect(result).toBe("id,date,time,weight,unit\n");
  });

  it("returns header + one data row for single entry", () => {
    const entry = makeEntry({ id: "e1", weightValue: 82.5, unit: "kg", timestamp: "2026-03-13T09:15:00.000Z" });
    const result = generateCSV([entry]);
    const lines = result.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("id,date,time,weight,unit");
    expect(lines[1]).toContain("e1");
    expect(lines[1]).toContain("2026-03-13");
    expect(lines[1]).toContain("09:15");
    expect(lines[1]).toContain("82.5");
    expect(lines[1]).toContain("kg");
  });

  it("places id as the first column in the data row", () => {
    const entry = makeEntry({ id: "abc-123", weightValue: 70, unit: "kg", timestamp: "2026-03-13T10:00:00.000Z" });
    const result = generateCSV([entry]);
    const dataLine = result.split("\n").filter(Boolean)[1];
    expect(dataLine.startsWith("abc-123,")).toBe(true);
  });

  it("preserves stored unit (lbs) in CSV row", () => {
    const entry = makeEntry({ weightValue: 180, unit: "lbs", timestamp: "2026-03-13T14:30:00.000Z" });
    const result = generateCSV([entry]);
    expect(result).toContain("lbs");
    expect(result).toContain("180");
  });

  it("generates correct rows for multiple entries", () => {
    const entries = [
      makeEntry({ id: "e1", weightValue: 82.5, unit: "kg", timestamp: "2026-03-13T09:15:00.000Z" }),
      makeEntry({ id: "e2", weightValue: 180, unit: "lbs", timestamp: "2026-03-12T08:00:00.000Z" }),
    ];
    const result = generateCSV(entries);
    const lines = result.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3);
  });
});

describe("generateJSON", () => {
  it("returns '[]' for empty array", () => {
    expect(generateJSON([])).toBe("[]");
  });

  it("returns stringified array matching storage schema for single entry", () => {
    const entry = makeEntry();
    const result = generateJSON([entry]);
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe(entry.id);
    expect(parsed[0].weightValue).toBe(entry.weightValue);
    expect(parsed[0].unit).toBe(entry.unit);
    expect(parsed[0].timestamp).toBe(entry.timestamp);
  });

  it("preserves stored unit (lbs) in JSON output", () => {
    const entry = makeEntry({ unit: "lbs", weightValue: 180 });
    const parsed = JSON.parse(generateJSON([entry]));
    expect(parsed[0].unit).toBe("lbs");
  });
});

describe("formatExportFilename", () => {
  it("returns 'weight-entries-YYYY-MM-DD.csv' for csv format", () => {
    const filename = formatExportFilename("csv");
    expect(filename).toMatch(/^weight-entries-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("returns 'weight-entries-YYYY-MM-DD.json' for json format", () => {
    const filename = formatExportFilename("json");
    expect(filename).toMatch(/^weight-entries-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("uses today's local date in the filename", () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const expectedDate = `${year}-${month}-${day}`;
    expect(formatExportFilename("csv")).toContain(expectedDate);
  });
});

describe("triggerDownload", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  it("creates an anchor element and triggers a click", () => {
    const clickSpy = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") {
        vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(clickSpy);
      }
      return el;
    });

    triggerDownload("content", "test.csv", "text/csv");
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("revokes the object URL after download", () => {
    triggerDownload("content", "test.csv", "text/csv");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
