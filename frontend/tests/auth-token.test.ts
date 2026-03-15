import { describe, it, expect, beforeEach, vi } from "vitest";
import { setAccessToken, getAccessToken, clearAccessToken } from "../src/ts/auth-token";

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
