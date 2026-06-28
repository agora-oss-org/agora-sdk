import React from "react";
import { vi } from "vitest";
import { Provider } from "react-redux";

import {
  makeReplykeStore,
  mockAxiosPrivate,
  mockAxiosPublic,
  type AxiosMockHandle,
  type ReplykeStore,
} from "../test-utils";
import { setTokens, setUser, setInitialized } from "../store/slices/authSlice";
import { ReplykeContext, type ReplykeContextValues } from "./replyke-context";
import type { AuthUser } from "../interfaces/models/User";

export interface ProvidersWrapperOptions {
  projectId?: string;
  project?: ReplykeContextValues["project"];
  user?: AuthUser | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  beforeRender?: (handles: {
    axiosPrivate: AxiosMockHandle;
    axiosPublic: AxiosMockHandle;
  }) => void;
}

export interface ProvidersWrapperResult {
  Wrapper: React.FC<{ children: React.ReactNode }>;
  store: ReplykeStore;
  axiosPrivate: AxiosMockHandle;
  axiosPublic: AxiosMockHandle;
}

/**
 * Builds the same Redux store + `ReplykeContext` wrapper `renderHookWithAxios`
 * uses, but as a standalone component instead of a `renderHook` wrapper —
 * for tests that need to nest a feature-specific context provider
 * (`EntityProvider`, `CommentSectionProvider`, `ChatProvider`, etc.) between
 * the Replyke context and the tree/hook under test, or that need to assert on
 * a provider's "renders nothing" branch via `render()` rather than
 * `renderHook()`.
 */
export function makeProvidersWrapper(
  options: ProvidersWrapperOptions = {},
): ProvidersWrapperResult {
  const {
    projectId = "test-project",
    project = null,
    user = null,
    accessToken = null,
    refreshToken = null,
    beforeRender,
  } = options;

  const store = makeReplykeStore();
  store.dispatch(setTokens({ accessToken, refreshToken }));
  store.dispatch(setUser(user));
  store.dispatch(setInitialized(true));

  const axiosPrivateHandle = mockAxiosPrivate();
  const axiosPublicHandle = mockAxiosPublic();
  beforeRender?.({ axiosPrivate: axiosPrivateHandle, axiosPublic: axiosPublicHandle });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>
      <ReplykeContext.Provider value={{ projectId, project } as ReplykeContextValues}>
        {children}
      </ReplykeContext.Provider>
    </Provider>
  );

  return { Wrapper, store, axiosPrivate: axiosPrivateHandle, axiosPublic: axiosPublicHandle };
}

export interface FakeSocket {
  connected: boolean;
  auth: Record<string, unknown>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  /** Simulate the server firing an event by invoking every handler registered via `on`. */
  trigger: (event: string, payload?: unknown) => void;
}

/**
 * A controllable fake socket.io-client `Socket` for tests that mock the
 * `socket.io-client` module (e.g. `ChatProvider`) — supports registering
 * handlers via `on`/`off` and firing them via `trigger`, mirroring the
 * chainable `connect()`/`disconnect()` API the real client exposes.
 */
export function createFakeSocket(): FakeSocket {
  const handlers = new Map<string, Set<(payload?: unknown) => void>>();

  const socket: FakeSocket = {
    connected: false,
    auth: {},
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return socket;
    }) as never,
    off: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      handlers.get(event)?.delete(handler);
      return socket;
    }) as never,
    emit: vi.fn(() => socket) as never,
    connect: vi.fn(() => {
      socket.connected = true;
      return socket;
    }) as never,
    disconnect: vi.fn(() => {
      socket.connected = false;
      return socket;
    }) as never,
    removeAllListeners: vi.fn(() => {
      handlers.clear();
      return socket;
    }) as never,
    trigger(event: string, payload?: unknown) {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },
  };

  return socket;
}
