import { describe, it, expect } from "vitest";

import reducer, {
  insertConversationPreview,
  removeConversationPreview,
  type ChatState,
} from "./chatSlice";
import { makeConversationPreview } from "../../test-utils";

function baseState(overrides: Partial<ChatState> = {}): ChatState {
  return {
    conversations: {},
    conversationList: {
      items: [],
      loading: false,
      hasMore: true,
      cursor: null,
    },
    messages: {},
    threads: {},
    typingUsers: {},
    socketConnected: false,
    totalUnreadCount: null,
    unreadConversationCount: null,
    ...overrides,
  };
}

describe("chatSlice — insertConversationPreview", () => {
  it("inserts an absent preview at the correct sorted position (lastMessageAt DESC)", () => {
    const older = makeConversationPreview({
      id: "older",
      lastMessageAt: "2024-01-01T00:00:00.000Z",
    });
    const newer = makeConversationPreview({
      id: "newer",
      lastMessageAt: "2024-01-03T00:00:00.000Z",
    });
    let state = baseState({
      conversationList: {
        items: [older],
        loading: false,
        hasMore: true,
        cursor: null,
      },
    });

    state = reducer(state, insertConversationPreview(newer));

    expect(state.conversationList.items.map((c) => c.id)).toEqual([
      "newer",
      "older",
    ]);
    // Mirrored into the per-conversation entry
    expect(state.conversations["newer"]?.data?.id).toBe("newer");
  });

  it("is idempotent when the preview is already present (patch, not duplicate)", () => {
    const existing = makeConversationPreview({
      id: "c1",
      lastMessageAt: "2024-01-01T00:00:00.000Z",
      unreadCount: 2,
    });
    let state = baseState({
      conversationList: {
        items: [existing],
        loading: false,
        hasMore: true,
        cursor: null,
      },
    });

    const patched = makeConversationPreview({
      id: "c1",
      lastMessageAt: "2024-01-05T00:00:00.000Z",
      unreadCount: 5,
    });
    state = reducer(state, insertConversationPreview(patched));

    expect(state.conversationList.items).toHaveLength(1);
    expect(state.conversationList.items[0].unreadCount).toBe(5);
    expect(state.conversationList.items[0].lastMessageAt).toBe(
      "2024-01-05T00:00:00.000Z"
    );
  });

  it("never mutates the global unread counters", () => {
    let state = baseState({
      totalUnreadCount: 3,
      unreadConversationCount: 1,
    });

    const preview = makeConversationPreview({ id: "c1", unreadCount: 7 });
    state = reducer(state, insertConversationPreview(preview));

    expect(state.totalUnreadCount).toBe(3);
    expect(state.unreadConversationCount).toBe(1);
  });
});

describe("chatSlice — removeConversationPreview", () => {
  it("removes a loaded preview with unread and decrements the globals (clamped)", () => {
    const preview = makeConversationPreview({ id: "c1", unreadCount: 2 });
    let state = baseState({
      conversationList: {
        items: [preview],
        loading: false,
        hasMore: true,
        cursor: null,
      },
      conversations: {
        c1: { data: preview, loading: false, error: null },
      },
      totalUnreadCount: 5,
      unreadConversationCount: 3,
    });

    state = reducer(state, removeConversationPreview("c1"));

    expect(state.conversationList.items).toHaveLength(0);
    expect(state.totalUnreadCount).toBe(3);
    expect(state.unreadConversationCount).toBe(2);
    // Cached detail bucket dropped
    expect(state.conversations["c1"]).toBeUndefined();
  });

  it("clamps the globals at 0 and never goes negative", () => {
    const preview = makeConversationPreview({ id: "c1", unreadCount: 10 });
    let state = baseState({
      conversationList: {
        items: [preview],
        loading: false,
        hasMore: true,
        cursor: null,
      },
      totalUnreadCount: 4,
      unreadConversationCount: 0,
    });

    state = reducer(state, removeConversationPreview("c1"));

    expect(state.totalUnreadCount).toBe(0);
    expect(state.unreadConversationCount).toBe(0);
  });

  it("does not touch the globals when the removed preview had no unread", () => {
    const preview = makeConversationPreview({ id: "c1", unreadCount: 0 });
    let state = baseState({
      conversationList: {
        items: [preview],
        loading: false,
        hasMore: true,
        cursor: null,
      },
      totalUnreadCount: 5,
      unreadConversationCount: 3,
    });

    state = reducer(state, removeConversationPreview("c1"));

    expect(state.conversationList.items).toHaveLength(0);
    expect(state.totalUnreadCount).toBe(5);
    expect(state.unreadConversationCount).toBe(3);
  });

  it("no-ops on the globals when the conversation is not loaded (leaves them to the summary refetch)", () => {
    let state = baseState({
      conversationList: {
        items: [makeConversationPreview({ id: "other", unreadCount: 1 })],
        loading: false,
        hasMore: true,
        cursor: null,
      },
      totalUnreadCount: 5,
      unreadConversationCount: 3,
    });

    state = reducer(state, removeConversationPreview("not-loaded"));

    expect(state.conversationList.items).toHaveLength(1);
    expect(state.totalUnreadCount).toBe(5);
    expect(state.unreadConversationCount).toBe(3);
  });
});
