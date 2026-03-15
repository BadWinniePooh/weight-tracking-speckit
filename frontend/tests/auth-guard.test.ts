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
