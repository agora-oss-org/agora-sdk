import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { CommentSectionContext } from "../../context/comment-section-context";
import useCommentSection from "./useCommentSection";

describe("useCommentSection", () => {
  it("returns an empty object when rendered outside a CommentSectionProvider", () => {
    const { result } = renderHook(() => useCommentSection());
    expect(result.current).toEqual({});
  });

  it("returns the value provided by the nearest CommentSectionContext", () => {
    const value = { comments: [], loading: false };
    const { result } = renderHook(() => useCommentSection(), {
      wrapper: ({ children }) => (
        <CommentSectionContext.Provider value={value as any}>
          {children}
        </CommentSectionContext.Provider>
      ),
    });

    expect(result.current).toBe(value);
  });
});
