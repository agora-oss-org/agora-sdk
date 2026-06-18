// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — resolve the API base URL at call time
// instead of from an eager constant.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import { useCallback, useEffect, useRef, useState } from "react";
import useProject from "../projects/useProject";
import { useReplykeSelector } from "../../store/hooks";
import { selectAccessToken } from "../../store/slices/authSlice";
import { getApiBaseUrl } from "../../config/runtime";
import { ContentSearchResult } from "./useSearchContent";

export interface UseAskContentProps {
  query: string;
  sourceTypes?: ("entity" | "comment" | "message")[];
  spaceId?: string;
  conversationId?: string;
  limit?: number;
  /**
   * Opt into per-row `spaceReputation` on embedded users. Accepted forms: a
   * space `<uuid>`, `"none"`, or `"context"`. Sent as a query param (the server
   * reads it from the query string, not the request body).
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

export interface UseAskContentReturn {
  /** Answer text — grows as token events arrive */
  answer: string;
  /** Hydrated source records — set once after streaming completes */
  sources: ContentSearchResult[];
  /** True while the SSE stream is open and tokens are arriving */
  streaming: boolean;
  /** True from the ask() call until the first token arrives (or an error occurs) */
  loading: boolean;
  error: string | null;
  ask: (props: UseAskContentProps) => void;
  /** Aborts any in-flight stream and resets all state */
  reset: () => void;
}

interface SseEvent {
  event: string;
  data: string;
}

/**
 * Parses raw SSE text from a ReadableStream chunk. Because TCP packets don't
 * align with SSE event boundaries, we maintain a buffer of incomplete text
 * across calls and return the leftover for the next iteration.
 */
function parseSseChunk(buffer: string): { events: SseEvent[]; remainder: string } {
  const events: SseEvent[] = [];
  // Events are delimited by a blank line (\n\n)
  const blocks = buffer.split("\n\n");
  // The last element is either empty (buffer ended cleanly) or an incomplete
  // block that hasn't received its terminating \n\n yet — keep it for next call.
  const remainder = blocks.pop() ?? "";

  for (const block of blocks) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    if (data) events.push({ event, data });
  }

  return { events, remainder };
}

export default function useAskContent(): UseAskContentReturn {
  const { projectId } = useProject();
  const accessToken = useReplykeSelector(selectAccessToken);

  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<ContentSearchResult[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Held across renders so reset() and unmount cleanup can abort an in-flight stream
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAnswer("");
    setSources([]);
    setStreaming(false);
    setLoading(false);
    setError(null);
  }, []);

  const ask = useCallback(
    ({ query, sourceTypes, spaceId, conversationId, limit, spaceReputationId, spaceReputationDescendants }: UseAskContentProps) => {
      if (!projectId) return;
      if (!query.trim()) return;

      // Cancel any previous stream before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Reset output state for the new query
      setAnswer("");
      setSources([]);
      setError(null);
      setLoading(true);
      setStreaming(false);

      const body = JSON.stringify({
        query,
        ...(sourceTypes && { sourceTypes }),
        ...(spaceId && { spaceId }),
        ...(conversationId && { conversationId }),
        ...(limit && { limit }),
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      // Run async without blocking the render cycle — errors are surfaced via state
      // spaceReputation opt-in is read from the query string by the server,
      // not the request body — append it to the URL.
      const queryString = (() => {
        const sp = new URLSearchParams();
        if (spaceReputationId !== undefined) sp.set("spaceReputationId", spaceReputationId);
        if (spaceReputationDescendants !== undefined)
          sp.set("spaceReputationDescendants", String(spaceReputationDescendants));
        const s = sp.toString();
        return s ? `?${s}` : "";
      })();

      (async () => {
        try {
          const response = await fetch(`${getApiBaseUrl()}/${projectId}/search/ask${queryString}`, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            const message = (() => {
              try {
                return JSON.parse(text)?.error ?? `Request failed (${response.status})`;
              } catch {
                return `Request failed (${response.status})`;
              }
            })();
            setError(message);
            setLoading(false);
            return;
          }

          if (!response.body) {
            setError(
              "Streaming is not supported in this environment. " +
              "In React Native, install react-native-fetch-api, web-streams-polyfill, and react-native-polyfill-globals, " +
              "then call polyfillGlobals() at app startup."
            );
            setLoading(false);
            return;
          }

          setStreaming(true);
          setLoading(false);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const { events, remainder } = parseSseChunk(buffer);
            buffer = remainder;

            for (const { event, data } of events) {
              if (event === "token") {
                const parsed = JSON.parse(data) as { content: string };
                setAnswer((prev) => prev + parsed.content);
              } else if (event === "sources") {
                const parsed = JSON.parse(data) as ContentSearchResult[];
                setSources(parsed);
              } else if (event === "done") {
                setStreaming(false);
              } else if (event === "error") {
                const parsed = JSON.parse(data) as { error: string };
                setError(parsed.error);
                setStreaming(false);
              }
            }
          }

          // Ensure streaming is cleared if the connection closes without a done event
          setStreaming(false);
        } catch (err) {
          if ((err as Error).name === "AbortError") return; // user called reset()
          setError("An unexpected error occurred");
          setStreaming(false);
          setLoading(false);
        }
      })();
    },
    [projectId, accessToken]
  );

  return { answer, sources, streaming, loading, error, ask, reset };
}
