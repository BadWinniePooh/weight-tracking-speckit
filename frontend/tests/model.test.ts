import { describe, it, expect } from "vitest";
import { validateWeight } from "../src/ts/model";

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

