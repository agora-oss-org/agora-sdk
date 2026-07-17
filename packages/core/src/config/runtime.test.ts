import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getEmailRedirectTo,
  registerAccessTokenGetter,
  getAccessToken,
  registerTokenRefresher,
  hasTokenRefresher,
  refreshAccessToken,
  armAuthLatch,
  markAuthSettled,
  whenAuthSettled,
  __resetAuthTransportForTests,
} from "./runtime";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getEmailRedirectTo", () => {
  it("falls back to window.location.origin when no env var is set", () => {
    expect(getEmailRedirectTo()).toBe(window.location.origin);
  });

  it("prefers the VITE_-prefixed AGORA_EMAIL_REDIRECT_TO env var over the window origin", () => {
    vi.stubEnv("VITE_AGORA_EMAIL_REDIRECT_TO", "https://demo.agora-oss.org");
    expect(getEmailRedirectTo()).toBe("https://demo.agora-oss.org");
  });

  it("also resolves the REACT_APP_-prefixed variant", () => {
    vi.stubEnv("REACT_APP_AGORA_EMAIL_REDIRECT_TO", "https://cra.agora-oss.org");
    expect(getEmailRedirectTo()).toBe("https://cra.agora-oss.org");
  });

  it("returns undefined when there is no env var and no window (RN path)", () => {
    vi.stubGlobal("window", undefined);
    expect(getEmailRedirectTo()).toBeUndefined();
  });
});

describe("auth transport registry (divergence #8)", () => {
  afterEach(() => {
    __resetAuthTransportForTests();
  });

  it("getAccessToken returns null when no getter is registered", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("returns the registered getter's current token", () => {
    let token: string | null = "token-1";
    registerAccessTokenGetter(() => token);
    expect(getAccessToken()).toBe("token-1");
    token = null;
    expect(getAccessToken()).toBeNull();
  });

  it("hasTokenRefresher flips when a refresher is registered", () => {
    expect(hasTokenRefresher()).toBe(false);
    registerTokenRefresher(async () => undefined);
    expect(hasTokenRefresher()).toBe(true);
  });

  it("refreshAccessToken resolves undefined when nothing is registered", async () => {
    await expect(refreshAccessToken()).resolves.toBeUndefined();
  });

  it("shares one in-flight refresh across concurrent callers", async () => {
    let resolveRefresh!: (t: string | undefined) => void;
    const refresher = vi.fn(
      () => new Promise<string | undefined>((r) => (resolveRefresh = r)),
    );
    registerTokenRefresher(refresher);

    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken();
    resolveRefresh("fresh");

    expect(await p1).toBe("fresh");
    expect(await p2).toBe("fresh");
    expect(refresher).toHaveBeenCalledTimes(1);
  });

  it("resolves undefined (never rejects) when the refresher throws", async () => {
    registerTokenRefresher(() => Promise.reject(new Error("boom")));
    await expect(refreshAccessToken()).resolves.toBeUndefined();
  });

  it("allows a new refresh after the previous one settles", async () => {
    const refresher = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    registerTokenRefresher(refresher);

    expect(await refreshAccessToken()).toBe("first");
    expect(await refreshAccessToken()).toBe("second");
    expect(refresher).toHaveBeenCalledTimes(2);
  });

  it("prefers an explicitly passed refresher over the registered one", async () => {
    registerTokenRefresher(async () => "registered");
    expect(await refreshAccessToken(async () => "explicit")).toBe("explicit");
  });
});

describe("auth-settled latch (divergence #8)", () => {
  afterEach(() => {
    __resetAuthTransportForTests();
  });

  it("whenAuthSettled resolves immediately when the latch was never armed", async () => {
    await expect(whenAuthSettled()).resolves.toBeUndefined();
  });

  it("parks callers after arming until markAuthSettled", async () => {
    armAuthLatch();
    let settled = false;
    const waiter = whenAuthSettled().then(() => {
      settled = true;
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(settled).toBe(false);

    markAuthSettled();
    await waiter;
    expect(settled).toBe(true);
  });

  it("is one-shot: re-arming after settle does not close the latch again", async () => {
    armAuthLatch();
    markAuthSettled();
    armAuthLatch();
    await expect(whenAuthSettled()).resolves.toBeUndefined();
  });

  it("markAuthSettled is a safe no-op when the latch was never armed", async () => {
    markAuthSettled();
    await expect(whenAuthSettled()).resolves.toBeUndefined();
  });
});
