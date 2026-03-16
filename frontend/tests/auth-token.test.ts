import { describe, it, expect, beforeEach, vi } from "vitest";
import { setAccessToken, getAccessToken, clearAccessToken, getUserRole, getUserId } from "../src/ts/auth-token";

describe("auth-token", () => {
  beforeEach(() => {
    // Reset module state between tests
    clearAccessToken();
  });

  it("getAccessToken returns null initially", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("setAccessToken then getAccessToken returns the token", () => {
    setAccessToken("my-token-xyz");
    expect(getAccessToken()).toBe("my-token-xyz");
  });

  it("clearAccessToken then getAccessToken returns null", () => {
    setAccessToken("some-token");
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});

// Helper: build a fake JWT with the given payload
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe("getUserRole", () => {
  beforeEach(() => {
    clearAccessToken();
  });

  it("returns null when no token is set", () => {
    expect(getUserRole()).toBeNull();
  });

  it("returns null on a malformed token (no dots)", () => {
    setAccessToken("notavalidtoken");
    expect(getUserRole()).toBeNull();
  });

  it("returns null when payload is not valid base64", () => {
    setAccessToken("header.!!!invalid!!!.sig");
    expect(getUserRole()).toBeNull();
  });

  it("returns null when payload has no role claim", () => {
    setAccessToken(makeToken({ sub: "user-id" }));
    expect(getUserRole()).toBeNull();
  });

  it("returns role from shorthand 'role' key", () => {
    setAccessToken(makeToken({ sub: "user-id", role: "admin" }));
    expect(getUserRole()).toBe("admin");
  });

  it("returns 'user' role from shorthand key", () => {
    setAccessToken(makeToken({ sub: "user-id", role: "user" }));
    expect(getUserRole()).toBe("user");
  });

  it("returns role from ASP.NET Core URI claim name", () => {
    setAccessToken(makeToken({
      sub: "user-id",
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "admin",
    }));
    expect(getUserRole()).toBe("admin");
  });

  it("prefers URI claim name over shorthand when both present", () => {
    setAccessToken(makeToken({
      sub: "user-id",
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "admin",
      role: "user",
    }));
    expect(getUserRole()).toBe("admin");
  });
});

describe("getUserId", () => {
  beforeEach(() => {
    clearAccessToken();
  });

  it("returns null when no token is set", () => {
    expect(getUserId()).toBeNull();
  });

  it("returns null on malformed token", () => {
    setAccessToken("notavalidtoken");
    expect(getUserId()).toBeNull();
  });

  it("returns sub claim value", () => {
    setAccessToken(makeToken({ sub: "abc-123", role: "admin" }));
    expect(getUserId()).toBe("abc-123");
  });

  it("returns null when sub claim is absent", () => {
    setAccessToken(makeToken({ role: "admin" }));
    expect(getUserId()).toBeNull();
  });
});
