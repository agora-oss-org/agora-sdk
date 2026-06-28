import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { resetAxiosMocks, makeChatMessage, makeConversationMember } from "../test-utils";
import { makeProvidersWrapper, createFakeSocket, type FakeSocket } from "./testHelpers";
import { ChatContext, type ChatContextValue } from "./chat-context";
import { ConversationProvider, useConversationContext } from "./conversation-context";

afterEach(() => {
  resetAxiosMocks();
});

function emptyMessagesPage() {
  return { messages: [], hasMore: false, oldestCreatedAt: null, newestCreatedAt: null };
}

function emptyMembersPage() {
  return { data: [] };
}

describe("ConversationProvider", () => {
  it("loads messages and members on mount and exposes them, along with conversationId", async () => {
    const { Wrapper, axiosPrivate } = makeProvidersWrapper({
      beforeRender: ({ axiosPrivate }) => {
        axiosPrivate.mockResponse("get", emptyMessagesPage());
        axiosPrivate.mockResponse("get", emptyMembersPage());
      },
    });

    const { result } = renderHook(() => useConversationContext(), {
      wrapper: ({ children }) => (
        <Wrapper>
          <ConversationProvider conversationId="conversation-1">{children}</ConversationProvider>
        </Wrapper>
      ),
    });

    await waitFor(() => expect(result.current.messagesLoading).toBe(false));
    await waitFor(() => expect(result.current.membersLoading).toBe(false));

    expect(result.current.conversationId).toBe("conversation-1");
    expect(result.current.messages).toEqual([]);
    expect(result.current.members).toEqual([]);
    expect(typeof result.current.send).toBe("function");

    const calls = axiosPrivate.calls("get");
    expect(calls[0].url).toBe("/test-project/chat/conversations/conversation-1/messages");
    expect(calls[1].url).toBe("/test-project/chat/conversations/conversation-1/members");
  });

  it("sends a message via the exposed send action", async () => {
    const { Wrapper, store, axiosPrivate } = makeProvidersWrapper({
      beforeRender: ({ axiosPrivate }) => {
        axiosPrivate.mockResponse("get", emptyMessagesPage());
        axiosPrivate.mockResponse("get", emptyMembersPage());
      },
    });

    const { result } = renderHook(() => useConversationContext(), {
      wrapper: ({ children }) => (
        <Wrapper>
          <ConversationProvider conversationId="conversation-1">{children}</ConversationProvider>
        </Wrapper>
      ),
    });

    await waitFor(() => expect(result.current.messagesLoading).toBe(false));

    const confirmed = makeChatMessage({ id: "message-1", conversationId: "conversation-1" });
    axiosPrivate.mockResponse("post", confirmed);

    await act(async () => {
      await result.current.send!({ content: "hi" });
    });

    const postCall = axiosPrivate.calls("post")[0];
    expect(postCall.url).toBe("/test-project/chat/conversations/conversation-1/messages");
    expect(postCall.body).toMatchObject({ content: "hi" });
  });

  it("joins the socket room on mount and leaves it on unmount", async () => {
    const fakeSocket: FakeSocket = createFakeSocket();
    const registerActiveConversation = vi.fn();
    const unregisterActiveConversation = vi.fn();

    const { Wrapper } = makeProvidersWrapper({
      beforeRender: ({ axiosPrivate }) => {
        axiosPrivate.mockResponse("get", emptyMessagesPage());
        axiosPrivate.mockResponse("get", emptyMembersPage());
      },
    });

    const chatContextValue: ChatContextValue = {
      socket: fakeSocket as never,
      connected: true,
      registerActiveConversation,
      unregisterActiveConversation,
    };

    const { unmount } = renderHook(() => useConversationContext(), {
      wrapper: ({ children }) => (
        <Wrapper>
          <ChatContext.Provider value={chatContextValue}>
            <ConversationProvider conversationId="conversation-1">{children}</ConversationProvider>
          </ChatContext.Provider>
        </Wrapper>
      ),
    });

    await waitFor(() =>
      expect(fakeSocket.emit).toHaveBeenCalledWith("join:conversation", {
        conversationId: "conversation-1",
      }),
    );
    expect(registerActiveConversation).toHaveBeenCalledWith("conversation-1");

    unmount();

    expect(fakeSocket.emit).toHaveBeenCalledWith("leave:conversation", {
      conversationId: "conversation-1",
    });
    expect(unregisterActiveConversation).toHaveBeenCalledWith("conversation-1");
  });

  it("adds a member to the exposed list when member:joined fires", async () => {
    const fakeSocket: FakeSocket = createFakeSocket();

    const { Wrapper } = makeProvidersWrapper({
      beforeRender: ({ axiosPrivate }) => {
        axiosPrivate.mockResponse("get", emptyMessagesPage());
        axiosPrivate.mockResponse("get", emptyMembersPage());
      },
    });

    const chatContextValue: ChatContextValue = {
      socket: fakeSocket as never,
      connected: true,
      registerActiveConversation: () => {},
      unregisterActiveConversation: () => {},
    };

    const { result } = renderHook(() => useConversationContext(), {
      wrapper: ({ children }) => (
        <Wrapper>
          <ChatContext.Provider value={chatContextValue}>
            <ConversationProvider conversationId="conversation-1">{children}</ConversationProvider>
          </ChatContext.Provider>
        </Wrapper>
      ),
    });

    await waitFor(() => expect(result.current.membersLoading).toBe(false));

    const member = makeConversationMember({ userId: "user-2", conversationId: "conversation-1" });

    act(() => {
      fakeSocket.trigger("member:joined", { conversationId: "conversation-1", member });
    });

    await waitFor(() => expect(result.current.members).toEqual([member]));
  });
});
