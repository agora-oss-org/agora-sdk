import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeConversationPreview } from "../../../test-utils";
import useConversations from "./useConversations";

afterEach(() => {
  resetAxiosMocks();
});

describe("useConversations", () => {
  it("fetches the first page on mount and computes a cursor from the last item", async () => {
    const first = makeConversationPreview({ id: "conversation-1", lastMessageAt: "2024-01-02T00:00:00.000Z", createdAt: "2024-01-01T00:00:00.000Z" });

    const { result, axiosPrivate } = renderHookWithAxios(
      () => useConversations(),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", { conversations: [first], hasMore: true }),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conversations).toEqual([first]);
    expect(result.current.hasMore).toBe(true);

    const [call] = axiosPrivate.calls("get");
    expect(call.url).toBe("/test-project/chat/conversations");
    expect(call.config?.params).toMatchObject({ limit: "20" });
  });

  it("loads more using the derived cursor", async () => {
    const first = makeConversationPreview({ id: "conversation-1", lastMessageAt: "2024-01-02T00:00:00.000Z", createdAt: "2024-01-01T00:00:00.000Z" });
    const second = makeConversationPreview({ id: "conversation-2" });

    const { result, axiosPrivate } = renderHookWithAxios(
      () => useConversations(),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", { conversations: [first], hasMore: true }),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    axiosPrivate.mockResponse("get", { conversations: [second], hasMore: false });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.conversations.map((c) => c.id)).toEqual(["conversation-1", "conversation-2"]);
    expect(result.current.hasMore).toBe(false);

    const calls = axiosPrivate.calls("get");
    expect(calls[1].config?.params).toMatchObject({
      cursor: new Date(first.lastMessageAt!).toISOString(),
      cursorCreatedAt: new Date(first.createdAt).toISOString(),
    });
  });

  it("filters by types", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(
      () => useConversations({ types: ["group", "direct"] }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", { conversations: [], hasMore: false }),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const [call] = axiosPrivate.calls("get");
    // Sent in the order passed, not sorted — sorting only happens internally
    // for the effect's dependency key, not the request param.
    expect(call.config?.params).toMatchObject({ types: "group,direct" });
  });

  it("creates a group conversation and prepends it to the list", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(
      () => useConversations(),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", { conversations: [], hasMore: false }),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const group = makeConversationPreview({ id: "group-1", type: "group", name: "Team" });
    axiosPrivate.mockResponse("post", group);

    let returned;
    await act(async () => {
      returned = await result.current.createGroup({ name: "Team", memberIds: ["user-2"] });
    });

    expect(returned).toEqual(group);
    expect(result.current.conversations).toEqual([group]);

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe("/test-project/chat/conversations");
    expect(call.body).toEqual({ type: "group", name: "Team", memberIds: ["user-2"] });
  });
});
