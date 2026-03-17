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

// ─── Password reset & email confirmation ──────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  return request<void>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  return request<void>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function confirmEmail(token: string): Promise<void> {
  return request<void>(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`);
}

// ─── Account self-service ─────────────────────────────────────────────────────

export interface MeResponse {
  id: string;
  username: string;
  email: string;
  role: string;
}

export async function getMe(): Promise<MeResponse> {
  return request<MeResponse>("/api/account/me");
}

export async function changeUsername(newUsername: string): Promise<{ username: string }> {
  return request<{ username: string }>("/api/account/username", {
    method: "PUT",
    body: JSON.stringify({ newUsername }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request<void>("/api/account/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function changeEmail(newEmail: string): Promise<{ message: string }> {
  return request<{ message: string }>("/api/account/email", {
    method: "PUT",
    body: JSON.stringify({ newEmail }),
  });
}

// ─── Admin user management response types ─────────────────────────────────────

export interface AdminUserDto {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  emailConfirmed: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  scheduledDeletionAt: string | null;
  hasActiveSession: boolean;
}

export interface AdminUserListResponse {
  users: AdminUserDto[];
}

export interface AuditLogParams {
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
  actionType?: string;
}

export interface AuditLogEntryDto {
  id: string;
  actionType: string;
  actorUserId: string;
  actorUsername: string;
  targetUserId: string | null;
  targetUsername: string | null;
  ipAddress: string;
  timestamp: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ─── Admin user management functions ─────────────────────────────────────────

export async function adminListUsers(): Promise<AdminUserListResponse> {
  return request<AdminUserListResponse>("/api/admin/users");
}

export async function adminCreateUser(
  username: string,
  email: string,
  role: string,
): Promise<AdminUserDto> {
  return request<AdminUserDto>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ username, email, role }),
  });
}

export async function adminDeactivateUser(
  id: string,
): Promise<{ id: string; isActive: boolean; scheduledDeletionAt: string | null }> {
  return request<{ id: string; isActive: boolean; scheduledDeletionAt: string | null }>(
    `/api/admin/users/${id}/deactivate`,
    { method: "POST" },
  );
}

export async function adminReactivateUser(
  id: string,
): Promise<{ id: string; isActive: boolean; scheduledDeletionAt: null }> {
  return request<{ id: string; isActive: boolean; scheduledDeletionAt: null }>(
    `/api/admin/users/${id}/reactivate`,
    { method: "POST" },
  );
}

export async function adminDeleteUser(id: string): Promise<void> {
  return request<void>(`/api/admin/users/${id}`, { method: "DELETE" });
}

export async function adminAssignRole(id: string, role: string): Promise<{ id: string; role: string }> {
  return request<{ id: string; role: string }>(`/api/admin/users/${id}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export async function adminResendConfirmation(id: string): Promise<void> {
  return request<void>(`/api/admin/users/${id}/resend-confirmation`, { method: "POST" });
}

export async function adminGetAuditLog(params: AuditLogParams = {}): Promise<AuditLogResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
  if (params.fromDate) query.set("fromDate", params.fromDate);
  if (params.toDate) query.set("toDate", params.toDate);
  if (params.actionType) query.set("actionType", params.actionType);
  const qs = query.toString();
  return request<AuditLogResponse>(`/api/admin/audit-log${qs ? `?${qs}` : ""}`);
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
