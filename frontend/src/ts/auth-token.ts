let _accessToken: string | null = null;

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearAccessToken(): void {
  _accessToken = null;
}

function decodePayload(): Record<string, unknown> | null {
  if (!_accessToken) return null;
  const parts = _accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    // Convert base64url to standard base64 before decoding
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getUserRole(): string | null {
  const payload = decodePayload();
  if (!payload) return null;
  const uriClaim = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
  if (typeof uriClaim === "string") return uriClaim;
  const shortClaim = payload["role"];
  if (typeof shortClaim === "string") return shortClaim;
  return null;
}

export function getUserId(): string | null {
  const payload = decodePayload();
  if (!payload) return null;
  const sub = payload["sub"];
  return typeof sub === "string" ? sub : null;
}
