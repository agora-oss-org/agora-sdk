import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import axiosPublic, { axiosPrivate, withAuthTransport } from "./axios";
import {
  getApiBaseUrl,
  registerAccessTokenGetter,
  registerTokenRefresher,
  armAuthLatch,
  markAuthSettled,
  __resetAuthTransportForTests,
} from "./runtime";
import {
  stubAxiosAdapter,
  okAxiosResponse,
  axiosErrorWithStatus,
  type AxiosAdapter,
} from "../test-utils";

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

describe("withAuthTransport (divergence #8)", () => {
  afterEach(() => {
    __resetAuthTransportForTests();
    vi.restoreAllMocks();
  });

  /** Fresh instance so the module singletons' interceptor arrays stay untouched. */
  function makeInstance(adapter: AxiosAdapter) {
    const instance = withAuthTransport(axios.create());
    stubAxiosAdapter(instance, adapter);
    return instance;
  }

  const okAdapter = () =>
    vi.fn(async (config: InternalAxiosRequestConfig) =>
      okAxiosResponse({ ok: true }, 200, config),
    );

  /** 401s any request not yet retried; succeeds on the retry. */
  const refreshableAdapter = () =>
    vi.fn(async (config: InternalAxiosRequestConfig & { sent?: boolean }) => {
      if (config.sent) return okAxiosResponse({ ok: true }, 200, config);
      throw axiosErrorWithStatus(401, undefined, config);
    });

  it("attaches the registered token to non-auth requests", async () => {
    registerAccessTokenGetter(() => "store-token");
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.get("/project-1/entities");

    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer store-token");
  });

  it("sends no Authorization header when there is no token", async () => {
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.get("/project-1/entities");

    expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined();
  });

  it("leaves an explicit Authorization header untouched", async () => {
    registerAccessTokenGetter(() => "store-token");
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.get("/project-1/entities", {
      headers: { Authorization: "Bearer explicit" },
    });

    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer explicit");
  });

  it("attaches the token to authed /auth/ routes (change-password et al)", async () => {
    registerAccessTokenGetter(() => "store-token");
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.post("/project-1/auth/change-password", {});

    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer store-token");
  });

  it("parks non-auth requests on the armed latch while /auth/ requests fly (deadlock guard)", async () => {
    armAuthLatch();
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    const parked = instance.get("/project-1/entities");
    await new Promise((r) => setTimeout(r, 0));
    expect(adapter).not.toHaveBeenCalled();

    await instance.post("/project-1/auth/request-new-access-token", {});
    expect(adapter).toHaveBeenCalledTimes(1);

    markAuthSettled();
    await parked;
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it("does not park an /auth/ request on an armed latch, and still attaches the token (change-password during boot)", async () => {
    armAuthLatch();
    registerAccessTokenGetter(() => "store-token");
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.post("/project-1/auth/change-password", {});

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer store-token");
  });

  it("refreshes once and retries with the new token on 401", async () => {
    let token = "stale";
    registerAccessTokenGetter(() => token);
    const refresher = vi.fn(async () => {
      token = "fresh";
      return "fresh" as string | undefined;
    });
    registerTokenRefresher(refresher);
    const adapter = refreshableAdapter();
    const instance = makeInstance(adapter);

    const response = await instance.get("/project-1/entities");

    expect(response.data).toEqual({ ok: true });
    expect(refresher).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[1][0].headers.Authorization).toBe("Bearer fresh");
  });

  it("shares one refresh across concurrent 401s on different instances (single-flight)", async () => {
    registerAccessTokenGetter(() => "stale");
    let resolveRefresh!: (t: string | undefined) => void;
    const refresher = vi.fn(
      () => new Promise<string | undefined>((r) => (resolveRefresh = r)),
    );
    registerTokenRefresher(refresher);
    const instanceA = makeInstance(refreshableAdapter());
    const instanceB = makeInstance(refreshableAdapter());

    const p1 = instanceA.get("/project-1/entities");
    const p2 = instanceB.get("/project-1/comments");
    await new Promise((r) => setTimeout(r, 0));
    expect(refresher).toHaveBeenCalledTimes(1);

    resolveRefresh("fresh");
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.data).toEqual({ ok: true });
    expect(r2.data).toEqual({ ok: true });
  });

  it("rejects with the original 401 when the refresh yields no token", async () => {
    registerTokenRefresher(async () => undefined);
    const instance = makeInstance(refreshableAdapter());

    await expect(instance.get("/project-1/entities")).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it("is transparent on 401 when no refresher is registered (does not consume the sent flag)", async () => {
    const adapter = refreshableAdapter();
    const instance = makeInstance(adapter);

    await expect(instance.get("/project-1/entities")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect((adapter.mock.calls[0][0] as { sent?: boolean }).sent).toBeUndefined();
  });

  it("passes /auth/ 401s through even with a refresher registered (failed sign-in)", async () => {
    const refresher = vi.fn(async () => "fresh" as string | undefined);
    registerTokenRefresher(refresher);
    const instance = makeInstance(refreshableAdapter());

    await expect(instance.post("/project-1/auth/sign-in", {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refresher).not.toHaveBeenCalled();
  });

  it("is installed on both singleton instances", () => {
    // 2 request interceptors each: base-URL stamper (handlers[0], asserted above) + auth.
    for (const instance of [axiosPublic, axiosPrivate]) {
      const req = (instance.interceptors.request as unknown as { handlers: unknown[] }).handlers;
      const res = (instance.interceptors.response as unknown as { handlers: unknown[] }).handlers;
      expect(req.length).toBe(2);
      expect(res.length).toBe(1);
    }
  });
});
