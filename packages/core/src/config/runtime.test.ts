import { describe, it, expect, afterEach, vi } from "vitest";
import { getEmailRedirectTo } from "./runtime";

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
