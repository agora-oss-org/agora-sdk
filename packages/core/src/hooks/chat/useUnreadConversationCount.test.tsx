import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios } from "../../test-utils";
import useUnreadConversationCount from "./useUnreadConversationCount";
import { setUnreadSummary } from "../../store/slices/chatSlice";

describe("useUnreadConversationCount", () => {
  it("defaults to 0 before the summary has been fetched", () => {
    const { result } = renderHookWithAxios(() => useUnreadConversationCount());
    expect(result.current).toBe(0);
  });

  it("reflects the unread conversation count from the chat slice", () => {
    const { result, store } = renderHookWithAxios(() => useUnreadConversationCount());

    act(() => {
      store.dispatch(setUnreadSummary({ totalUnread: 7, unreadConversationCount: 3 }));
    });

    expect(result.current).toBe(3);
  });
});
