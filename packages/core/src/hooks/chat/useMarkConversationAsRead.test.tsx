import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeConversationPreview } from "../../test-utils";
import useMarkConversationAsRead from "./useMarkConversationAsRead";
import { setConversationList } from "../../store/slices/chatSlice";

afterEach(() => {
  resetAxiosMocks();
});

describe("useMarkConversationAsRead", () => {
  it("clears the local unread count immediately and posts the read receipt", async () => {
    const preview = makeConversationPreview({ id: "conversation-1", unreadCount: 5 });

    const { result, store, axiosPrivate } = renderHookWithAxios(() =>
      useMarkConversationAsRead({ conversationId: "conversation-1" }),
    );
    act(() => {
      store.dispatch(setConversationList([preview]));
    });

    axiosPrivate.mockResponse("post", {});

    await act(async () => {
      await result.current({ messageId: "message-1" });
    });

    expect(store.getState().replyke.chat.conversationList.items[0].unreadCount).toBe(0);

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe("/test-project/chat/conversations/conversation-1/read");
    expect(call.body).toEqual({ messageId: "message-1" });
  });

  it("keeps the optimistic clear even when the server request fails", async () => {
    const preview = makeConversationPreview({ id: "conversation-1", unreadCount: 5 });

    const { result, store, axiosPrivate } = renderHookWithAxios(() =>
      useMarkConversationAsRead({ conversationId: "conversation-1" }),
    );
    act(() => {
      store.dispatch(setConversationList([preview]));
    });

    axiosPrivate.mockError("post", 500, { message: "Internal error" });

    await expect(
      act(async () => {
        await result.current({ messageId: "message-1" });
      }),
    ).resolves.not.toThrow();

    expect(store.getState().replyke.chat.conversationList.items[0].unreadCount).toBe(0);
  });

  it("does nothing when there is no conversation/message/project ID", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useMarkConversationAsRead({ conversationId: "" }),
    );

    await act(async () => {
      await result.current({ messageId: "message-1" });
    });

    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });
});
