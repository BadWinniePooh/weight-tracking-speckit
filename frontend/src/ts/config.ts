// ─── Runtime config (loaded from /config.json at startup) ────────────────────

import { getCachedConfig, setCachedConfig } from "./offline-store";

interface AppConfig {
  apiUrl: string;
}

let _config: AppConfig | null = null;

export async function loadConfig(): Promise<void> {
  try {
    const response = await fetch("/config.json");
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    _config = await response.json() as AppConfig;
    setCachedConfig(_config);
  } catch (err) {
    // Offline (or config endpoint down): fall back to the copy cached during
    // the last online session so the app shell can still boot.
    const cached = getCachedConfig();
    if (!cached) throw err;
    _config = cached;
  }
}

export function getApiUrl(): string {
  if (!_config) {
    throw new Error("Config not loaded — call loadConfig() first.");
  }
  return _config.apiUrl.replace(/\/$/, ""); // strip trailing slash
}
