import type { WeightEntry, ChartSettings } from "./model";
import { getUserId, getUserRole } from "./auth-token";

// Offline persistence for the 018 offline-first feature. Everything lives under
// the wt_offline:: prefix — the legacy weight_tracker_* keys belong to the
// feature-001 migration flow (migration-tool.ts scans them on every load) and
// must never be reused here.

const PREFIX = "wt_offline::";

export interface AuthMarker {
  userId: string;
  role: string;
  refreshExpiresAt: string;
}

export type PendingOp =
  | { type: "create"; entry: WeightEntry }
  | { type: "delete"; id: string };

export interface CachedConfig {
  apiUrl: string;
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Auth marker ──────────────────────────────────────────────────────────────

const AUTH_KEY = `${PREFIX}auth`;

export function saveAuthMarker(marker: AuthMarker): void {
  writeJson(AUTH_KEY, marker);
}

export function getAuthMarker(): AuthMarker | null {
  const marker = readJson<AuthMarker>(AUTH_KEY);
  if (!marker || typeof marker.userId !== "string" || typeof marker.refreshExpiresAt !== "string") {
    return null;
  }
  return marker;
}

export function clearAuthMarker(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function isMarkerValid(now: number = Date.now()): boolean {
  const marker = getAuthMarker();
  if (!marker) return false;
  const expiry = Date.parse(marker.refreshExpiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

// Mirrors the server's sliding refresh-token window (AuthConstants.RefreshTokenDays).
const REFRESH_WINDOW_DAYS = 7;

/**
 * Record that a login or token refresh just succeeded, using the identity claims
 * from the freshly stored in-memory access token. The marker holds an expiry
 * date only — never the token — and gates nothing but the local UI shell.
 */
export function recordSuccessfulAuth(): void {
  const userId = getUserId();
  if (!userId) return;
  saveAuthMarker({
    userId,
    role: getUserRole() ?? "user",
    refreshExpiresAt: new Date(Date.now() + REFRESH_WINDOW_DAYS * 86400_000).toISOString(),
  });
}

// ─── Per-user entry cache ─────────────────────────────────────────────────────

const entriesKey = (userId: string) => `${PREFIX}${userId}::entries`;

export function getCachedEntries(userId: string): WeightEntry[] {
  return readJson<WeightEntry[]>(entriesKey(userId)) ?? [];
}

export function setCachedEntries(userId: string, entries: WeightEntry[]): void {
  writeJson(entriesKey(userId), entries);
}

// ─── Per-user pending operation queue (FIFO) ──────────────────────────────────

const pendingKey = (userId: string) => `${PREFIX}${userId}::pending`;

export function getPendingOps(userId: string): PendingOp[] {
  return readJson<PendingOp[]>(pendingKey(userId)) ?? [];
}

export function setPendingOps(userId: string, ops: PendingOp[]): void {
  writeJson(pendingKey(userId), ops);
}

export function enqueueOp(userId: string, op: PendingOp): void {
  const ops = getPendingOps(userId);
  ops.push(op);
  setPendingOps(userId, ops);
}

// ─── Per-user settings cache ──────────────────────────────────────────────────

const settingsKey = (userId: string) => `${PREFIX}${userId}::settings`;

export function getCachedSettings(userId: string): ChartSettings | null {
  return readJson<ChartSettings>(settingsKey(userId));
}

export function setCachedSettings(userId: string, settings: ChartSettings): void {
  writeJson(settingsKey(userId), settings);
}

// ─── Config cache (runtime apiUrl fallback when /config.json is unreachable) ──

const CONFIG_KEY = `${PREFIX}config`;

export function getCachedConfig(): CachedConfig | null {
  return readJson<CachedConfig>(CONFIG_KEY);
}

export function setCachedConfig(config: CachedConfig): void {
  writeJson(CONFIG_KEY, config);
}
