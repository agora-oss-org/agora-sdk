import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeConversation } from "../../../test-utils";
import useCreateDirectConversation from "./useCreateDirectConversation";
import { selectConversation } from "../../../store/slices/chatSlice";

afterEach(() => {
  resetAxiosMocks();
});

describe("useCreateDirectConversation", () => {
  it("creates a direct conversation and stores it in the chat slice", async () => {
    const { result, store, axiosPrivate } = renderHookWithAxios(() =>
      useCreateDirectConversation(),
    );

    const conversation = makeConversation({ type: "direct" });
    axiosPrivate.mockResponse("post", conversation);

    let returned;
    await act(async () => {
      returned = await result.current({ userId: "user-2" });
    });

    expect(returned).toEqual(conversation);
    expect(selectConversation(conversation.id)(store.getState())).toEqual(conversation);

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe("/test-project/chat/conversations/direct");
    expect(call.body).toEqual({ userId: "user-2" });
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useCreateDirectConversation(),
    );

    axiosPrivate.mockError("post", 500, { message: "Internal error" });

    await expect(
      result.current({ userId: "user-2" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when no user ID is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useCreateDirectConversation(),
    );

    await expect(result.current({ userId: "" })).rejects.toThrow(
      "Please pass a userId.",
    );
    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });
});
