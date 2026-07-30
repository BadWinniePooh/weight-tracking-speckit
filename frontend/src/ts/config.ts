// ─── Runtime config (loaded from /config.json at startup) ────────────────────

interface AppConfig {
  apiUrl: string;
}

let _config: AppConfig | null = null;

export async function loadConfig(): Promise<void> {
  const response = await fetch("/config.json");
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status}`);
  }
  _config = await response.json() as AppConfig;
}

export function getApiUrl(): string {
  if (!_config) {
    throw new Error("Config not loaded — call loadConfig() first.");
  }
  return _config.apiUrl.replace(/\/$/, ""); // strip trailing slash
}
