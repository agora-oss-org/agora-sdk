import { describe, it, expect, vi, afterEach } from "vitest";
import type { BaseQueryApi } from "@reduxjs/toolkit/query";

import { dynamicBaseQuery } from "./baseApi";
import {
  registerTokenRefresher,
  armAuthLatch,
  markAuthSettled,
  __resetAuthTransportForTests,
} from "../../config/runtime";

function makeApi(accessToken: string | null): BaseQueryApi {
  return {
    getState: () => ({ replyke: { auth: { accessToken } } }),
    dispatch: vi.fn(),
    signal: new AbortController().signal,
    abort: vi.fn(),
    extra: undefined,
    endpoint: "test",
    type: "query",
    forced: false,
    queryCacheKey: "test",
  } as never;
}

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  __resetAuthTransportForTests();
  vi.unstubAllGlobals();
});

describe("dynamicBaseQuery (divergence #8)", () => {
  it("retries once through the shared refresh on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const refresher = vi.fn(async () => "fresh" as string | undefined);
    registerTokenRefresher(refresher);

    const result = await dynamicBaseQuery("/x", makeApi("stale"), {});

    expect(refresher).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ ok: true });
  });

  it("surfaces the 401 without retrying when no refresher is registered", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const result = await dynamicBaseQuery("/x", makeApi(null), {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.error).toMatchObject({ status: 401 });
  });

  it("surfaces the 401 when the refresh yields no token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    registerTokenRefresher(async () => undefined);

    const result = await dynamicBaseQuery("/x", makeApi("stale"), {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.error).toMatchObject({ status: 401 });
  });

  it("parks on the armed boot latch until auth settles", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }, 200));
    vi.stubGlobal("fetch", fetchMock);
    armAuthLatch();

    const pending = dynamicBaseQuery("/x", makeApi(null), {});
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();

    markAuthSettled();
    const result = await pending;
    expect(result.data).toEqual({ ok: true });
  });
});
