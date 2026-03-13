export type { WeightUnit } from "./model";
import { loadPreferences, savePreferences } from "./storage";
import type { WeightUnit } from "./model";

export function getUnit(): WeightUnit {
  return loadPreferences().unit;
}

export function setUnit(unit: WeightUnit): void {
  savePreferences({ unit });
}
