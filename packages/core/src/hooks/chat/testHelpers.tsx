import React from "react";
import { vi } from "vitest";
import { renderHook, type RenderHookResult } from "@testing-library/react";
import { Provider } from "react-redux";

import {
  makeReplykeStore,
  mockAxiosPrivate,
  mockAxiosPublic,
  type AxiosMockHandle,
} from "../../test-utils";
import { setTokens, setUser, setInitialized } from "../../store/slices/authSlice";
import { ReplykeContext, type ReplykeContextValues } from "../../context/replyke-context";
import { ChatContext, type ChatContextValue } from "../../context/chat-context";
import type { AuthUser } from "../../interfaces/models/User";

export function makeFakeSocket() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

export interface RenderWithChatContextOptions {
  projectId?: string;
  user?: AuthUser | null;
  chatContextValue?: Partial<ChatContextValue>;
  beforeRender?: (handles: {
    axiosPrivate: AxiosMockHandle;
    axiosPublic: AxiosMockHandle;
  }) => void;
}

export interface RenderWithChatContextResult<Result>
  extends RenderHookResult<Result, unknown> {
  axiosPrivate: AxiosMockHandle;
  axiosPublic: AxiosMockHandle;
}

/**
 * Like `renderHookWithAxios`, but also nests a `ChatContext.Provider` — needed
 * by hooks (`useChatSocket`, `useTypingIndicator`) that read the shared socket
 * instance from that context rather than taking it as a parameter.
 */
export function renderWithChatContext<Result>(
  callback: () => Result,
  options: RenderWithChatContextOptions = {},
): RenderWithChatContextResult<Result> {
  const { projectId = "test-project", user = null, chatContextValue = {}, beforeRender } = options;

  const store = makeReplykeStore();
  store.dispatch(setTokens({ accessToken: null, refreshToken: null }));
  store.dispatch(setUser(user));
  store.dispatch(setInitialized(true));

  const axiosPrivateHandle = mockAxiosPrivate();
  const axiosPublicHandle = mockAxiosPublic();

  beforeRender?.({ axiosPrivate: axiosPrivateHandle, axiosPublic: axiosPublicHandle });

  const contextValue: ChatContextValue = {
    socket: null,
    connected: false,
    registerActiveConversation: () => {},
    unregisterActiveConversation: () => {},
    ...chatContextValue,
  };

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <ReplykeContext.Provider
          value={{ projectId, project: null } as ReplykeContextValues}
        >
          <ChatContext.Provider value={contextValue}>
            {children}
          </ChatContext.Provider>
        </ReplykeContext.Provider>
      </Provider>
    );
  }

  const rendered = renderHook(callback, { wrapper: Wrapper });

  return { ...rendered, axiosPrivate: axiosPrivateHandle, axiosPublic: axiosPublicHandle };
}
