import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { setApiBaseUrl } from "../../config/runtime";
import { renderHookWithAxios, makeEntity } from "../../test-utils";
import useAskContent from "./useAskContent";

// Agora divergence (#1): useAskContent resolves the API base URL at call time via getApiBaseUrl(),
// which is runtime-injected (no hardcoded brand host). Configure the fixture's expected base URL.
beforeEach(() => {
  setApiBaseUrl("https://api.replyke.io/v7");
});

afterEach(() => {
  setApiBaseUrl("http://localhost:4000/v7");
  vi.unstubAllGlobals();
});

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function makeStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe("useAskContent", () => {
  it("streams tokens into the answer and sets sources when the stream completes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeStreamResponse([
        sse("token", { content: "Hello" }),
        sse("token", { content: " world" }),
        sse("sources", [{ sourceType: "entity", similarity: 0.9, record: makeEntity() }]),
        sse("done", {}),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithAxios(() => useAskContent());

    act(() => {
      result.current.ask({ query: "What is this about?" });
    });

    await waitFor(() => expect(result.current.answer).toBe("Hello world"));
    await waitFor(() => expect(result.current.streaming).toBe(false));

    expect(result.current.sources).toEqual([
      { sourceType: "entity", similarity: 0.9, record: makeEntity() },
    ]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    const [, init] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.replyke.io/v7/test-project/search/ask",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ query: "What is this about?" });
  });

  it("attaches an Authorization header when an access token is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeStreamResponse([sse("done", {})]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithAxios(() => useAskContent(), {
      accessToken: "token-123",
    });

    act(() => {
      result.current.ask({ query: "hello" });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer token-123");
  });

  it("surfaces a non-OK response as an error without streaming", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithAxios(() => useAskContent());

    act(() => {
      result.current.ask({ query: "hello" });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Rate limited");
    expect(result.current.streaming).toBe(false);
  });

  it("surfaces an error event emitted mid-stream", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeStreamResponse([
        sse("token", { content: "partial" }),
        sse("error", { error: "Model unavailable" }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithAxios(() => useAskContent());

    act(() => {
      result.current.ask({ query: "hello" });
    });

    await waitFor(() => expect(result.current.error).toBe("Model unavailable"));
    expect(result.current.streaming).toBe(false);
  });

  it("reset() aborts the in-flight stream and clears state", async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedSignal = init.signal as AbortSignal;
      return new Promise(() => {}); // never resolves — simulates an in-flight request
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithAxios(() => useAskContent());

    act(() => {
      result.current.ask({ query: "hello" });
    });

    await waitFor(() => expect(result.current.loading).toBe(true));

    act(() => {
      result.current.reset();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.answer).toBe("");
    expect(result.current.loading).toBe(false);
    expect(result.current.streaming).toBe(false);
  });

  it("does not call fetch for a blank query or a missing project", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithAxios(() => useAskContent(), { projectId: "" });

    act(() => {
      result.current.ask({ query: "hello" });
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
