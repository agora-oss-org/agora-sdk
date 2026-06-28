import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { setApiBaseUrl } from "../config/runtime";
import {
  resetAxiosMocks,
  makeChatMessage,
  makeConversationPreview,
  makeAuthUser,
} from "../test-utils";
import { makeProvidersWrapper, createFakeSocket, type FakeSocket } from "./testHelpers";
import {
  selectMessages,
  selectTypingUsers,
  selectConversationList,
  setConversationList,
  setUnreadSummary,
} from "../store/slices/chatSlice";

const fakeSocket: FakeSocket = createFakeSocket();

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => fakeSocket),
}));

import { io } from "socket.io-client";
import { ChatProvider, useChatContext } from "./chat-context";

// Agora divergence (#1): the API/socket URL is runtime-injected, not a brand-host default.
// Configure the fixture's expected base URL so getSocketUrl() resolves to it.
beforeEach(() => {
  setApiBaseUrl("https://api.replyke.io/v7");
});

afterEach(() => {
  setApiBaseUrl("http://localhost:4000/v7");
  resetAxiosMocks();
  vi.mocked(io).mockClear();
  fakeSocket.on.mockClear();
  fakeSocket.off.mockClear();
  fakeSocket.emit.mockClear();
  fakeSocket.connect.mockClear();
  fakeSocket.disconnect.mockClear();
  fakeSocket.removeAllListeners.mockClear();
  fakeSocket.connected = false;
});

function renderChatProvider(accessToken: string | null = "token-1", userId?: string) {
  const { Wrapper, store, axiosPrivate } = makeProvidersWrapper({
    accessToken,
    user: userId ? makeAuthUser({ id: userId }) : null,
    beforeRender: ({ axiosPrivate }) =>
      axiosPrivate.mockResponse("get", { totalUnread: 0, unreadConversationCount: 0 }),
  });

  const rendered = renderHook(() => useChatContext(), {
    wrapper: ({ children }) => (
      <Wrapper>
        <ChatProvider>{children}</ChatProvider>
      </Wrapper>
    ),
  });

  return { ...rendered, store, axiosPrivate };
}

describe("ChatProvider", () => {
  it("opens a socket using the access token and project id, and exposes connected once it connects", async () => {
    const { result, axiosPrivate } = renderChatProvider("token-1");

    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    const [, options] = vi.mocked(io).mock.calls[0];
    expect(vi.mocked(io).mock.calls[0][0]).toBe("https://api.replyke.io");
    expect(options).toMatchObject({ auth: { token: "token-1" }, query: { projectId: "test-project" } });

    expect(result.current.socket).toBe(fakeSocket);
    expect(result.current.connected).toBe(false);

    act(() => {
      fakeSocket.trigger("connect");
    });

    expect(result.current.connected).toBe(true);
  });

  it("does not open a socket when there is no access token", () => {
    renderChatProvider(null);
    expect(io).not.toHaveBeenCalled();
  });

  it("dispatches an incoming message and increments unread for a loaded, inactive conversation", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));
    await waitFor(() => expect(store.getState().replyke.chat.totalUnreadCount).toBe(0));

    // Seed the conversation into the loaded inbox list (loaded path).
    act(() => {
      store.dispatch(
        setConversationList([makeConversationPreview({ id: "conversation-1" })]),
      );
    });

    const message = makeChatMessage({ id: "message-1", conversationId: "conversation-1" });

    act(() => {
      fakeSocket.trigger("message:created", message);
    });

    expect(selectMessages("conversation-1")(store.getState())).toEqual([message]);
    expect(store.getState().replyke.chat.totalUnreadCount).toBe(1);
    expect(store.getState().replyke.chat.unreadConversationCount).toBe(1);
  });

  it("does not bump unread for a conversation registered as active", async () => {
    const { result, store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));
    await waitFor(() => expect(store.getState().replyke.chat.totalUnreadCount).toBe(0));

    act(() => {
      store.dispatch(
        setConversationList([makeConversationPreview({ id: "conversation-1" })]),
      );
      result.current.registerActiveConversation("conversation-1");
    });

    const message = makeChatMessage({ id: "message-1", conversationId: "conversation-1" });
    act(() => {
      fakeSocket.trigger("message:created", message);
    });

    expect(store.getState().replyke.chat.totalUnreadCount).toBe(0);
  });

  it("tracks typing:start/typing:stop into the chat slice", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      fakeSocket.trigger("typing:start", { userId: "user-2", conversationId: "conversation-1" });
    });
    expect(selectTypingUsers("conversation-1")(store.getState())).toEqual(["user-2"]);

    act(() => {
      fakeSocket.trigger("typing:stop", { userId: "user-2", conversationId: "conversation-1" });
    });
    expect(selectTypingUsers("conversation-1")(store.getState())).toEqual([]);
  });

  it("disconnects and removes listeners on unmount", async () => {
    const { unmount, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    unmount();

    expect(fakeSocket.removeAllListeners).toHaveBeenCalled();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });
});

// ─── Unread-accounting regression matrix (Task 4.1) ──────────────────────────
// The four accounting cases the live-list plan calls out as the highest-risk
// area, plus the insert/remove provider flows. Uses REAL timers + `waitFor` for
// the debounced authoritative refetch — fake timers corrupt the React scheduler.
describe("ChatProvider — unread accounting", () => {
  const chat = (store: { getState: () => any }) => store.getState().replyke.chat;

  it("(a) message in a loaded, already-unread conversation bumps total only — no double-count", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      store.dispatch(
        setConversationList([makeConversationPreview({ id: "c1", unreadCount: 1 })]),
      );
      store.dispatch(setUnreadSummary({ totalUnread: 1, unreadConversationCount: 1 }));
    });

    act(() => {
      fakeSocket.trigger(
        "message:created",
        makeChatMessage({ id: "m1", conversationId: "c1" }),
      );
    });

    expect(chat(store).totalUnreadCount).toBe(2);
    // Already unread → conversation count must NOT increment again
    expect(chat(store).unreadConversationCount).toBe(1);
  });

  it("(b) message in a loaded, previously-read conversation bumps both once", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      store.dispatch(
        setConversationList([makeConversationPreview({ id: "c1", unreadCount: 0 })]),
      );
      store.dispatch(setUnreadSummary({ totalUnread: 0, unreadConversationCount: 0 }));
    });

    act(() => {
      fakeSocket.trigger(
        "message:created",
        makeChatMessage({ id: "m1", conversationId: "c1" }),
      );
    });

    expect(chat(store).totalUnreadCount).toBe(1);
    expect(chat(store).unreadConversationCount).toBe(1);
  });

  it("(c) message in a not-loaded conversation defers globals to the debounced refetch (no client arithmetic)", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      store.dispatch(setUnreadSummary({ totalUnread: 0, unreadConversationCount: 0 }));
    });

    // Queue the preview fetch, then the authoritative summary refetch.
    axiosPrivate.mockResponse("get", makeConversationPreview({ id: "c1", unreadCount: 1 }));
    axiosPrivate.mockResponse("get", { totalUnread: 1, unreadConversationCount: 1 });

    act(() => {
      fakeSocket.trigger(
        "message:created",
        makeChatMessage({ id: "m1", conversationId: "c1" }),
      );
    });

    // No client-side increment for a not-loaded conversation
    expect(chat(store).totalUnreadCount).toBe(0);

    // The preview is fetched and inserted
    await waitFor(() =>
      expect(selectConversationList(store.getState()).some((c) => c.id === "c1")).toBe(true),
    );

    // Globals land on the authoritative refetch value (no over/undershoot)
    await waitFor(() => expect(chat(store).totalUnreadCount).toBe(1), { timeout: 2000 });
    expect(chat(store).unreadConversationCount).toBe(1);
  });

  it("(d) removing a not-loaded conversation self-corrects globals via refetch, not a guessed decrement", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      store.dispatch(setUnreadSummary({ totalUnread: 5, unreadConversationCount: 2 }));
    });

    // The authoritative summary after the conversation is gone
    axiosPrivate.mockResponse("get", { totalUnread: 3, unreadConversationCount: 1 });

    act(() => {
      fakeSocket.trigger("conversation:deleted", { conversationId: "not-loaded" });
    });

    // Not loaded → no guessed decrement happens synchronously
    expect(chat(store).totalUnreadCount).toBe(5);
    expect(chat(store).unreadConversationCount).toBe(2);

    // Debounced authoritative refetch corrects them
    await waitFor(() => expect(chat(store).totalUnreadCount).toBe(3), { timeout: 2000 });
    expect(chat(store).unreadConversationCount).toBe(1);
  });

  it("conversation:created inserts the row from the full preview payload", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      fakeSocket.trigger(
        "conversation:created",
        makeConversationPreview({ id: "new-c", lastMessageAt: "2024-02-01T00:00:00.000Z" }),
      );
    });

    expect(selectConversationList(store.getState()).map((c) => c.id)).toContain("new-c");
  });

  it("member:left (self) removes a loaded conversation and decrements globals", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1", "user-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      store.dispatch(
        setConversationList([makeConversationPreview({ id: "c1", unreadCount: 2 })]),
      );
      store.dispatch(setUnreadSummary({ totalUnread: 5, unreadConversationCount: 3 }));
    });

    act(() => {
      fakeSocket.trigger("member:left", { userId: "user-1", conversationId: "c1" });
    });

    expect(selectConversationList(store.getState()).some((c) => c.id === "c1")).toBe(false);
    expect(chat(store).totalUnreadCount).toBe(3);
    expect(chat(store).unreadConversationCount).toBe(2);
  });

  it("member:left for another user does not remove the conversation", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1", "user-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      store.dispatch(
        setConversationList([makeConversationPreview({ id: "c1" })]),
      );
    });

    act(() => {
      fakeSocket.trigger("member:left", { userId: "user-2", conversationId: "c1" });
    });

    expect(selectConversationList(store.getState()).some((c) => c.id === "c1")).toBe(true);
  });

  it("conversation:deleted removes a loaded conversation from the inbox", async () => {
    const { store, axiosPrivate } = renderChatProvider("token-1");
    await waitFor(() => expect(axiosPrivate.calls("get")).toHaveLength(1));

    act(() => {
      store.dispatch(
        setConversationList([makeConversationPreview({ id: "c1" })]),
      );
    });

    act(() => {
      fakeSocket.trigger("conversation:deleted", { conversationId: "c1" });
    });

    expect(selectConversationList(store.getState()).some((c) => c.id === "c1")).toBe(false);
  });
});
