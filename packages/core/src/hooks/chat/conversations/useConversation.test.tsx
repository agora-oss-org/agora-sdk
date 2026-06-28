import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeConversation } from "../../../test-utils";
import useConversation from "./useConversation";

afterEach(() => {
  resetAxiosMocks();
});

describe("useConversation", () => {
  it("fetches the conversation on mount when not already in the store", async () => {
    const conversation = makeConversation({ id: "conversation-1" });

    const { result } = renderHookWithAxios(
      () => useConversation({ conversationId: "conversation-1" }),
      {
        beforeRender: ({ axiosPrivate }) => axiosPrivate.mockResponse("get", conversation),
      },
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.conversation).toEqual(conversation));
    expect(result.current.loading).toBe(false);
  });

  it("does not throw and stops loading when the fetch fails", async () => {
    const { result } = renderHookWithAxios(
      () => useConversation({ conversationId: "conversation-1" }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockError("get", 500, { message: "Internal error" }),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conversation).toBeNull();
  });

  it("updates the conversation and reflects the change", async () => {
    const conversation = makeConversation({ id: "conversation-1", name: "Old" });

    const { result, axiosPrivate } = renderHookWithAxios(
      () => useConversation({ conversationId: "conversation-1" }),
      {
        beforeRender: ({ axiosPrivate }) => axiosPrivate.mockResponse("get", conversation),
      },
    );

    await waitFor(() => expect(result.current.conversation).toEqual(conversation));

    const updated = { ...conversation, name: "New" };
    axiosPrivate.mockResponse("patch", updated);

    let returned;
    await act(async () => {
      returned = await result.current.update({ name: "New" });
    });

    expect(returned).toEqual(updated);
    expect(result.current.conversation).toEqual(updated);

    const [call] = axiosPrivate.calls("patch");
    expect(call.url).toBe("/test-project/chat/conversations/conversation-1");
    expect(call.body).toEqual({ name: "New" });
  });

  it("deletes the conversation", async () => {
    const conversation = makeConversation({ id: "conversation-1" });

    const { result, axiosPrivate } = renderHookWithAxios(
      () => useConversation({ conversationId: "conversation-1" }),
      {
        beforeRender: ({ axiosPrivate }) => axiosPrivate.mockResponse("get", conversation),
      },
    );

    await waitFor(() => expect(result.current.conversation).toEqual(conversation));

    axiosPrivate.mockResponse("delete", undefined, 204);

    await act(async () => {
      await result.current.deleteConversation();
    });

    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/chat/conversations/conversation-1");
  });
});
