export type WeightUnit = "kg" | "lbs";

export interface WeightEntry {
  id: string;
  weightValue: number;
  unit: WeightUnit;
  timestamp: string;
}

export interface UserPreferences {
  unit: WeightUnit;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateWeight(raw: string, unit: WeightUnit): ValidationResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { valid: false, error: "Please enter a weight value." };
  }

  const value = Number(trimmed);
  if (isNaN(value) || trimmed === "") {
    return { valid: false, error: "Weight must be a number." };
  }

  // Check for non-numeric characters
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { valid: false, error: "Weight must be a number." };
  }

  if (value <= 0) {
    return { valid: false, error: "Weight must be greater than zero." };
  }

  const max = unit === "kg" ? 635 : 1400;
  const min = unit === "kg" ? 1 : 2;

  if (value < min) {
    return { valid: false, error: "Weight must be greater than zero." };
  }

  if (value > max) {
    return { valid: false, error: "Weight seems too high. Please check your entry." };
  }

  return { valid: true };
}

export function createEntry(weightValue: number, unit: WeightUnit): WeightEntry {
  return {
    id: crypto.randomUUID(),
    weightValue,
    unit,
    timestamp: new Date().toISOString(),
  };
}
