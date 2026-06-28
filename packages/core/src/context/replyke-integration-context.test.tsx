import { describe, it, expect, afterEach, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { renderHook, waitFor } from "@testing-library/react";

import { mockAxiosPublic, resetAxiosMocks } from "../test-utils";
import { replykeReducers, replykeApiReducer, replykeMiddleware } from "../store/integration";
import { useReplykeSelector } from "../store/hooks";
import { selectInitialized } from "../store/slices/authSlice";
import { ReplykeIntegrationProvider } from "./replyke-integration-context";
import useProject from "../hooks/projects/useProject";

afterEach(() => {
  resetAxiosMocks();
});

describe("ReplykeIntegrationProvider (host-owned external store)", () => {
  it("mounts replykeReducers/replykeApiReducer/replykeMiddleware into a host-built store and bootstraps project + auth state", async () => {
    const axiosPublic = mockAxiosPublic();
    axiosPublic.mockResponse("get", { id: "test-project", integrations: [] });

    // A store built the way a host app would, per the provider's own JSDoc:
    // replyke reducers/middleware mounted alongside the host's own reducer.
    const externalStore = configureStore({
      reducer: {
        replyke: replykeReducers,
        replykeApi: replykeApiReducer,
        host: (state = { ownedByHost: true }) => state,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(...replykeMiddleware),
    });

    const { result } = renderHook(
      () => ({
        project: useProject(),
        initialized: useReplykeSelector(selectInitialized),
      }),
      {
        wrapper: ({ children }) => (
          <Provider store={externalStore}>
            <ReplykeIntegrationProvider projectId="test-project">
              {children}
            </ReplykeIntegrationProvider>
          </Provider>
        ),
      },
    );

    await waitFor(() =>
      expect(result.current.project.project).toEqual({ id: "test-project", integrations: [] }),
    );
    expect(result.current.project.projectId).toBe("test-project");

    await waitFor(() => expect(result.current.initialized).toBe(true));

    // The host's own slice survived being mounted alongside replyke's.
    expect((externalStore.getState() as { host: unknown }).host).toEqual({
      ownedByHost: true,
    });

    const [call] = axiosPublic.calls("get");
    expect(call.url).toBe("/test-project/projects/lean");
  });

  it("throws when no projectId is provided", () => {
    const externalStore = configureStore({
      reducer: { replyke: replykeReducers, replykeApi: replykeApiReducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(...replykeMiddleware),
    });

    // React + jsdom log the error to console even though it's caught below —
    // silence that expected noise for this one test.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      renderHook(() => null, {
        wrapper: ({ children }) => (
          <Provider store={externalStore}>
            <ReplykeIntegrationProvider projectId={"" as never}>
              {children}
            </ReplykeIntegrationProvider>
          </Provider>
        ),
      }),
    ).toThrow("Please pass a project ID");

    consoleSpy.mockRestore();
  });
});
