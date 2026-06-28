import { describe, it, expect } from "vitest";

import axiosPublic, { axiosPrivate } from "./axios";
import { getApiBaseUrl } from "./runtime";

describe("config/axios", () => {
  it("stamps the runtime API base URL on each request via interceptor", () => {
    // Agora divergence (#1): the base URL is injected at runtime (config/runtime.ts) and applied
    // lazily by a request interceptor, not baked onto `defaults.baseURL` at module load. There is
    // no exported BASE_URL constant; the interceptor derives it from getApiBaseUrl() per request.
    const handler = (
      axiosPrivate.interceptors.request as unknown as {
        handlers: {
          fulfilled: (c: { headers: Record<string, unknown> }) => { baseURL?: string };
        }[];
      }
    ).handlers[0].fulfilled;
    const cfg = handler({ headers: {} });
    expect(cfg.baseURL).toBe(getApiBaseUrl());
  });

  it("configures axiosPrivate with a JSON content type", () => {
    expect(axiosPrivate.defaults.headers["Content-Type"]).toBe("application/json");
  });

  it("exposes two distinct instances", () => {
    expect(axiosPrivate).not.toBe(axiosPublic);
  });
});
