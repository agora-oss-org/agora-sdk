import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeChatMessage } from "../../../test-utils";
import useDeleteMessage from "./useDeleteMessage";
import { upsertMessage, selectMessages } from "../../../store/slices/chatSlice";

afterEach(() => {
  resetAxiosMocks();
});

describe("useDeleteMessage", () => {
  it("deletes the message on the server and soft-removes it locally", async () => {
    const message = makeChatMessage({ id: "message-1", content: "hi" });

    const { result, store, axiosPrivate } = renderHookWithAxios(() => useDeleteMessage());
    act(() => {
      store.dispatch(upsertMessage(message));
    });

    axiosPrivate.mockResponse("delete", undefined, 204);

    await act(async () => {
      await result.current({ conversationId: "conversation-1", messageId: "message-1" });
    });

    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/chat/conversations/conversation-1/messages/message-1");

    const messages = selectMessages("conversation-1")(store.getState());
    expect(messages[0].content).toBeNull();
    expect(messages[0].userDeletedAt).not.toBeNull();
  });

  it("rejects and leaves the message untouched when the server request fails", async () => {
    const message = makeChatMessage({ id: "message-1", content: "hi" });

    const { result, store, axiosPrivate } = renderHookWithAxios(() => useDeleteMessage());
    act(() => {
      store.dispatch(upsertMessage(message));
    });

    axiosPrivate.mockError("delete", 500, { message: "Internal error" });

    await expect(
      result.current({ conversationId: "conversation-1", messageId: "message-1" }),
    ).rejects.toMatchObject({ response: { status: 500 } });

    const messages = selectMessages("conversation-1")(store.getState());
    expect(messages[0].content).toBe("hi");
  });

  it("throws before making a request when there is no projectId", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useDeleteMessage(), {
      projectId: "",
    });

    await expect(
      result.current({ conversationId: "conversation-1", messageId: "message-1" }),
    ).rejects.toThrow("No projectId available.");
    expect(axiosPrivate.calls("delete")).toHaveLength(0);
  });
});
