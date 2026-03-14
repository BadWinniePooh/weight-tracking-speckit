import { getApiUrl } from "./config";
import type { WeightEntry, ChartDataSet, ChartSettings } from "./model";

// ─── Typed API error ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Response shapes (match contracts/api.md) ─────────────────────────────────

export interface EntryListResponse {
  entries: WeightEntry[];
}

export interface EntryResponse extends WeightEntry {}

export interface MigrationResult {
  migratedEntries: number;
  skippedEntries: number;
  settingsMigrated: boolean;
  skippedReasons: string[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    let field: string | undefined;
    try {
      const body = await response.json() as { error?: string; field?: string };
      if (body.error) errorMessage = body.error;
      field = body.field;
    } catch {
      // non-JSON body — keep default message
    }
    throw new ApiError(errorMessage, response.status, field);
  }

  // 204 No Content — return undefined cast as T
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Entry operations ─────────────────────────────────────────────────────────

export async function getEntries(): Promise<EntryListResponse> {
  return request<EntryListResponse>("/api/entries");
}

export async function createEntry(payload: {
  id?: string;
  weightValue: number;
  unit: string;
  timestamp: string;
}): Promise<EntryResponse> {
  return request<EntryResponse>("/api/entries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteEntry(id: string): Promise<void> {
  return request<void>(`/api/entries/${id}`, { method: "DELETE" });
}

export async function deleteAllEntries(): Promise<void> {
  return request<void>("/api/entries", { method: "DELETE" });
}

// ─── Chart data ───────────────────────────────────────────────────────────────

export async function getChartData(): Promise<ChartDataSet> {
  return request<ChartDataSet>("/api/chart");
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<ChartSettings> {
  return request<ChartSettings>("/api/settings");
}

export async function updateSettings(settings: Partial<ChartSettings>): Promise<ChartSettings> {
  return request<ChartSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

// ─── Migration ────────────────────────────────────────────────────────────────

export async function migrateFromLocalStorage(payload: {
  entries: Array<{ id?: string; weightValue: number; unit: string; timestamp: string }>;
  settings?: Partial<ChartSettings>;
}): Promise<MigrationResult> {
  return request<MigrationResult>("/api/migrate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
