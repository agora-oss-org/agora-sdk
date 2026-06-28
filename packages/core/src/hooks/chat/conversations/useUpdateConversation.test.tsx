import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeConversation } from "../../../test-utils";
import useUpdateConversation from "./useUpdateConversation";

afterEach(() => {
  resetAxiosMocks();
});

describe("useUpdateConversation", () => {
  it("updates a conversation", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateConversation());

    const updated = makeConversation({ name: "New name" });
    axiosPrivate.mockResponse("patch", updated);

    let returned;
    await act(async () => {
      returned = await result.current({ conversationId: "conversation-1", name: "New name" });
    });

    expect(returned).toEqual(updated);

    const [call] = axiosPrivate.calls("patch");
    expect(call.url).toBe("/test-project/chat/conversations/conversation-1");
    expect(call.body).toEqual({ name: "New name" });
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateConversation());

    axiosPrivate.mockError("patch", 500, { message: "Internal error" });

    await expect(
      result.current({ conversationId: "conversation-1", name: "New name" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when no conversation ID is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateConversation());

    await expect(
      result.current({ conversationId: "", name: "New name" }),
    ).rejects.toThrow("Please pass a conversationId.");
    expect(axiosPrivate.calls("patch")).toHaveLength(0);
  });
});
