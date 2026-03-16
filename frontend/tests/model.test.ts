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

  describe("regex edge cases — format validation", () => {
    it("accepts integer values without decimal part (kg)", () => {
      const result = validateWeight("80", "kg");
      expect(result.valid).toBe(true);
    });

    it("accepts decimal values (kg)", () => {
      const result = validateWeight("80.5", "kg");
      expect(result.valid).toBe(true);
    });

    it("accepts two decimal digits (e.g. '80.15')", () => {
      expect(validateWeight("80.15", "kg").valid).toBe(true);
    });

    it("returns error for value with trailing dot (e.g. '80.')", () => {
      const result = validateWeight("80.", "kg");
      expect(result.valid).toBe(false);
    });

    it("regex error message is 'Weight must be a number.' for trailing dot", () => {
      expect(validateWeight("80.", "kg").error).toBe("Weight must be a number.");
    });

    it("returns error for hex notation (e.g. '0x10')", () => {
      expect(validateWeight("0x10", "kg").valid).toBe(false);
    });

    it("returns error for value starting with a dot (e.g. '.5')", () => {
      const result = validateWeight(".5", "kg");
      expect(result.valid).toBe(false);
    });

    it("returns error for value with multiple decimal points (e.g. '8.0.5')", () => {
      const result = validateWeight("8.0.5", "kg");
      expect(result.valid).toBe(false);
    });

    it("returns error for scientific notation (e.g. '1e5')", () => {
      const result = validateWeight("1e5", "kg");
      expect(result.valid).toBe(false);
    });

    it("returns error for value with trailing non-numeric chars (e.g. '80a')", () => {
      const result = validateWeight("80a", "kg");
      expect(result.valid).toBe(false);
    });

    it("returns error for value with spaces between digits (e.g. '8 0')", () => {
      const result = validateWeight("8 0", "kg");
      expect(result.valid).toBe(false);
    });
  });

  describe("boundary values — exact limits", () => {
    it("exactly 635 kg is valid", () => {
      expect(validateWeight("635", "kg").valid).toBe(true);
    });

    it("exactly 636 kg is invalid", () => {
      expect(validateWeight("636", "kg").valid).toBe(false);
    });

    it("exactly 1 kg is valid (minimum kg)", () => {
      expect(validateWeight("1", "kg").valid).toBe(true);
    });

    it("exactly 2 lbs is valid (minimum lbs)", () => {
      expect(validateWeight("2", "lbs").valid).toBe(true);
    });

    it("exactly 1400 lbs is valid", () => {
      expect(validateWeight("1400", "lbs").valid).toBe(true);
    });

    it("exactly 1401 lbs is invalid", () => {
      expect(validateWeight("1401", "lbs").valid).toBe(false);
    });

    it("value of 0.5 kg is below minimum (1 kg) — returns error", () => {
      expect(validateWeight("0.5", "kg").valid).toBe(false);
    });
  });
});

