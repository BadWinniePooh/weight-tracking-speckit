import { getApiUrl } from "./config";
import { getAccessToken, setAccessToken, clearAccessToken } from "./auth-token";
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

// ─── Silent refresh deduplication lock ────────────────────────────────────────

let _refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const { accessToken } = (await res.json()) as { accessToken: string };
        setAccessToken(accessToken);
        return true;
      }
    } catch {
      // network error
    }
    return false;
  })().finally(() => {
    _refreshPromise = null;
  });

  return _refreshPromise;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    // Attempt silent refresh
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      const retryHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      };
      if (newToken) retryHeaders["Authorization"] = `Bearer ${newToken}`;

      const retryResponse = await fetch(url, { ...init, headers: retryHeaders });
      if (retryResponse.status === 401) {
        clearAccessToken();
        window.location.href = "/login.html";
        throw new ApiError("Authentication required.", 401);
      }
      if (!retryResponse.ok) {
        const errBody = await retryResponse.json().catch(() => ({})) as { error?: string; field?: string };
        throw new ApiError(errBody.error ?? `HTTP ${retryResponse.status}`, retryResponse.status, errBody.field);
      }
      if (retryResponse.status === 204) return undefined as T;
      return retryResponse.json() as Promise<T>;
    } else {
      clearAccessToken();
      window.location.href = "/login.html";
      throw new ApiError("Authentication required.", 401);
    }
  }

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
