import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

import { replykeReducers } from "../../store/replykeReducers";
import { baseApi } from "../../store/api/baseApi";
import { ReplykeContext } from "../../context/replyke-context";
import { useTable } from "./useTable";

function makeStore() {
  return configureStore({
    reducer: {
      replyke: replykeReducers,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (gdm) =>
      gdm({ serializableCheck: false, immutableCheck: false }).concat(
        baseApi.middleware,
      ),
  });
}

const ROWS = [
  { id: "1", name: "alpha" },
  { id: "2", name: "bravo" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchMock: any;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// jsdom swaps in its own AbortController whose AbortSignal node's undici
// `Request` rejects. RTK Query's fetchBaseQuery builds `new Request(url, {
// signal })` before calling fetch, so the query throws at construction. Shim
// Request to a lenient passthrough that just carries url/method (the signal is
// irrelevant to these tests).
class TestRequest {
  url: string;
  method: string;
  headers: unknown;
  private init: Record<string, unknown>;
  constructor(input: unknown, init: Record<string, unknown> = {}) {
    const base = (typeof input === "string" ? { url: input } : input) as {
      url: string;
      method?: string;
      headers?: unknown;
      init?: Record<string, unknown>;
    };
    this.url = base.url;
    this.init = { ...(base.init ?? {}), ...init };
    this.method = (this.init.method as string) ?? base.method ?? "GET";
    this.headers = this.init.headers ?? base.headers;
  }
  clone() {
    return new TestRequest(this);
  }
}

beforeEach(() => {
  vi.stubGlobal("Request", TestRequest);
  fetchMock = vi.fn(async (...args: unknown[]) => {
    const req = args[0] as Request | string;
    const url = typeof req === "string" ? req : req.url;
    const method =
      (typeof req === "string"
        ? (args[1] as RequestInit | undefined)?.method
        : (req as Request).method) ?? "GET";

    if (method === "GET" && url.includes("/db/Events")) {
      return jsonResponse({
        data: ROWS,
        pagination: {
          page: 1,
          pageSize: 20,
          totalPages: 1,
          totalItems: 2,
          hasMore: false,
        },
      });
    }
    if (method === "POST" && url.includes("/db/Events")) {
      return jsonResponse({ row: { id: "3", name: "charlie" } }, 201);
    }
    return jsonResponse({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// One stable store per renderHook call — recreating it on every re-render would
// wipe RTK Query's cache.
function makeWrapper() {
  const store = makeStore();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <ReplykeContext.Provider
          value={{ projectId: "test-project", project: null } as never}
        >
          {children}
        </ReplykeContext.Provider>
      </Provider>
    );
  };
}

describe("useTable", () => {
  it("loads rows from the /db surface", async () => {
    const { result } = renderHook(() => useTable("Events"), { wrapper: makeWrapper() });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(result.current.pagination?.totalItems).toBe(2);

    // The GET hit the logical-name /db route.
    const getCall = fetchMock.mock.calls.find((c: unknown[]) => {
      const req = c[0] as Request | string;
      const url = typeof req === "string" ? req : req.url;
      return url.includes("/test-project/db/Events");
    });
    expect(getCall).toBeTruthy();
  });

  it("createRow issues a POST and returns the new row", async () => {
    const { result } = renderHook(() => useTable("Events"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.createRow({ name: "charlie" });
    });
    expect(created?.id).toBe("3");

    const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
      const req = c[0] as Request | string;
      const method =
        typeof req === "string"
          ? (c[1] as RequestInit | undefined)?.method
          : (req as Request).method;
      return method === "POST";
    });
    expect(postCall).toBeTruthy();
  });

  it("exposes view controls that update the slice", async () => {
    const { result } = renderHook(() => useTable("Events"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setIncludeDeleted(true));
    await waitFor(() =>
      expect(result.current.view.includeDeleted).toBe(true),
    );
    expect(result.current.view.page).toBe(1);
  });
});
