import { describe, it, expect, vi } from "vitest";
import { validateWeight, createEntry } from "../src/ts/model";

describe("validateWeight", () => {
  describe("empty / missing value", () => {
    it("returns error for empty string", () => {
      const result = validateWeight("", "kg");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Please enter a weight value.");
    });

    it("returns error for whitespace-only string", () => {
      const result = validateWeight("  ", "kg");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Please enter a weight value.");
    });
  });

  describe("non-numeric value", () => {
    it("returns error for alphabetic input", () => {
      const result = validateWeight("abc", "kg");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Weight must be a number.");
    });

    it("returns error for mixed alphanumeric input", () => {
      const result = validateWeight("75kg", "kg");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Weight must be a number.");
    });
  });

  describe("zero and negative values", () => {
    it("returns error for zero", () => {
      const result = validateWeight("0", "kg");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Weight must be greater than zero.");
    });

    it("returns error for negative value", () => {
      const result = validateWeight("-5", "kg");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Weight must be greater than zero.");
    });
  });

  describe("plausible range — kg", () => {
    it("accepts minimum valid kg value (1)", () => {
      const result = validateWeight("1", "kg");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts maximum valid kg value (635)", () => {
      const result = validateWeight("635", "kg");
      expect(result.valid).toBe(true);
    });

    it("accepts a typical kg value", () => {
      const result = validateWeight("82.5", "kg");
      expect(result.valid).toBe(true);
    });

    it("returns error when kg value exceeds 635", () => {
      const result = validateWeight("636", "kg");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Weight seems too high. Please check your entry.");
    });
  });

  describe("plausible range — lbs", () => {
    it("accepts minimum valid lbs value (2)", () => {
      const result = validateWeight("2", "lbs");
      expect(result.valid).toBe(true);
    });

    it("accepts maximum valid lbs value (1400)", () => {
      const result = validateWeight("1400", "lbs");
      expect(result.valid).toBe(true);
    });

    it("accepts a typical lbs value", () => {
      const result = validateWeight("180", "lbs");
      expect(result.valid).toBe(true);
    });

    it("returns error when lbs value exceeds 1400", () => {
      const result = validateWeight("1401", "lbs");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Weight seems too high. Please check your entry.");
    });

    it("returns error for lbs value below minimum (1)", () => {
      const result = validateWeight("1", "lbs");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Weight must be greater than zero.");
    });
  });
});

describe("createEntry", () => {
  it("stamps a UUID id using crypto.randomUUID()", () => {
    const mockUUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(mockUUID as `${string}-${string}-${string}-${string}-${string}`);

    const entry = createEntry(75, "kg");
    expect(entry.id).toBe(mockUUID);

    vi.restoreAllMocks();
  });

  it("stamps an ISO 8601 timestamp", () => {
    const before = new Date().toISOString();
    const entry = createEntry(75, "kg");
    const after = new Date().toISOString();

    expect(entry.timestamp >= before).toBe(true);
    expect(entry.timestamp <= after).toBe(true);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("stores the provided weightValue", () => {
    const entry = createEntry(82.5, "kg");
    expect(entry.weightValue).toBe(82.5);
  });

  it("stores the provided unit", () => {
    const entry = createEntry(180, "lbs");
    expect(entry.unit).toBe("lbs");
  });

  it("each call produces a unique id", () => {
    const entry1 = createEntry(70, "kg");
    const entry2 = createEntry(70, "kg");
    expect(entry1.id).not.toBe(entry2.id);
  });
});
