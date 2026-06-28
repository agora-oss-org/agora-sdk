import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios } from "../../test-utils";
import useTotalUnreadCount from "./useTotalUnreadCount";
import { setUnreadSummary } from "../../store/slices/chatSlice";

describe("useTotalUnreadCount", () => {
  it("defaults to 0 before the summary has been fetched", () => {
    const { result } = renderHookWithAxios(() => useTotalUnreadCount());
    expect(result.current).toBe(0);
  });

  it("reflects the total unread count from the chat slice", () => {
    const { result, store } = renderHookWithAxios(() => useTotalUnreadCount());

    act(() => {
      store.dispatch(setUnreadSummary({ totalUnread: 7, unreadConversationCount: 3 }));
    });

    expect(result.current).toBe(7);
  });
});
