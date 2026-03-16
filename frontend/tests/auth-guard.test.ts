import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AuthState } from "../src/ts/auth-guard";
import { enforceRedirect } from "../src/ts/auth-guard";

// Mock window.location
const originalLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe("enforceRedirect", () => {
  it("app + authenticated → no redirect", () => {
    const state: AuthState = { isAuthenticated: true, setupRequired: false };
    enforceRedirect("app", state);
    expect(window.location.href).toBe("");
  });

  it("app + not authenticated + not setupRequired → /login.html", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: false };
    enforceRedirect("app", state);
    expect(window.location.href).toBe("/login.html");
  });

  it("app + not authenticated + setupRequired → /setup.html", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: true };
    enforceRedirect("app", state);
    expect(window.location.href).toBe("/setup.html");
  });

  it("login + authenticated → /index.html", () => {
    const state: AuthState = { isAuthenticated: true, setupRequired: false };
    enforceRedirect("login", state);
    expect(window.location.href).toBe("/index.html");
  });

  it("login + setupRequired → /setup.html", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: true };
    enforceRedirect("login", state);
    expect(window.location.href).toBe("/setup.html");
  });

  it("login + not authenticated + not setupRequired → no redirect", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: false };
    enforceRedirect("login", state);
    expect(window.location.href).toBe("");
  });

  it("setup + setupRequired → no redirect", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: true };
    enforceRedirect("setup", state);
    expect(window.location.href).toBe("");
  });

  it("setup + authenticated → /index.html", () => {
    const state: AuthState = { isAuthenticated: true, setupRequired: false };
    enforceRedirect("setup", state);
    expect(window.location.href).toBe("/index.html");
  });

  it("setup + not authenticated + not setupRequired → /login.html", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: false };
    enforceRedirect("setup", state);
    expect(window.location.href).toBe("/login.html");
  });
});

describe("enforceRedirect — edge cases for survived mutants", () => {
  it("app + isAuthenticated=true + setupRequired=true → no redirect (already authenticated)", () => {
    // The condition is !isAuthenticated && setupRequired — both must be true for /setup.html redirect.
    // Changing && to || would incorrectly redirect an authenticated user.
    const state: AuthState = { isAuthenticated: true, setupRequired: true };
    enforceRedirect("app", state);
    expect(window.location.href).toBe("");
  });

  it("app + isAuthenticated=false + setupRequired=false → /login.html (not /setup.html)", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: false };
    enforceRedirect("app", state);
    expect(window.location.href).toBe("/login.html");
  });

  it("login + isAuthenticated=false + setupRequired=false → no redirect (stays on login)", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: false };
    enforceRedirect("login", state);
    expect(window.location.href).toBe("");
  });

  it("setup + isAuthenticated=false + setupRequired=true → no redirect (stays on setup)", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: true };
    enforceRedirect("setup", state);
    expect(window.location.href).toBe("");
  });

  it("unknown pageType → no redirect (all branches are missed)", () => {
    const state: AuthState = { isAuthenticated: false, setupRequired: false };
    // @ts-expect-error — testing runtime fallthrough
    enforceRedirect("unknown", state);
    expect(window.location.href).toBe("");
  });
});
