import { describe, it, expect, afterEach, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeSpace } from "../../test-utils";
import useSpaceMentions, { type UseSpaceMentionsProps } from "./useSpaceMentions";

afterEach(() => {
  resetAxiosMocks();
});

// Real timers throughout — see hooks/users/useUserMentions.test.tsx for why
// fake timers are avoided here.

describe("useSpaceMentions", () => {
  it("activates mention state and fetches suggestions after the debounce delay", async () => {
    const setContent = vi.fn();
    const focus = vi.fn();

    const { result, axiosPrivate } = renderHookWithAxios(
      (props: UseSpaceMentionsProps) => useSpaceMentions(props),
      {
        initialProps: {
          content: "hello #des",
          setContent,
          focus,
          cursorPosition: 10,
          isSelectionActive: false,
          debounceDelay: 10,
        },
      },
    );

    expect(result.current.isSpaceMentionActive).toBe(true);

    const suggestions = [makeSpace({ slug: "design" }), makeSpace({ id: "space-2", slug: "design-systems" })];
    axiosPrivate.mockResponse("get", { data: suggestions, pagination: { page: 1, pageSize: 5, totalPages: 1, totalItems: 2, hasMore: false } });

    await waitFor(() => expect(result.current.spaceMentionSuggestions).toEqual(suggestions));

    const [call] = axiosPrivate.calls("get");
    expect(call.config?.params).toMatchObject({ searchAny: "des", limit: 5 });

    act(() => {
      result.current.handleSpaceMentionClick(suggestions[0]);
    });

    expect(setContent).toHaveBeenCalledWith("hello #design ");
    expect(focus).toHaveBeenCalledTimes(1);
    expect(result.current.mentions).toEqual([
      { id: "space-1", slug: "design", type: "space" },
    ]);
    expect(result.current.isSpaceMentionActive).toBe(false);
  });

  it("does not activate mention state when there is no trigger before the cursor", () => {
    const { result, axiosPrivate } = renderHookWithAxios(
      (props: UseSpaceMentionsProps) => useSpaceMentions(props),
      {
        initialProps: {
          content: "hello world",
          setContent: vi.fn(),
          focus: vi.fn(),
          cursorPosition: 11,
          isSelectionActive: false,
          debounceDelay: 10,
        },
      },
    );

    expect(result.current.isSpaceMentionActive).toBe(false);
    expect(axiosPrivate.calls("get")).toHaveLength(0);
  });

  it("addSpaceMention is idempotent for the same space ID and throws for a slugless space", () => {
    const { result } = renderHookWithAxios(
      (props: UseSpaceMentionsProps) => useSpaceMentions(props),
      {
        initialProps: {
          content: "",
          setContent: vi.fn(),
          focus: vi.fn(),
          cursorPosition: 0,
          isSelectionActive: false,
        },
      },
    );

    const design = makeSpace({ slug: "design" });

    act(() => {
      result.current.addSpaceMention(design);
      result.current.addSpaceMention(design);
    });
    expect(result.current.mentions).toHaveLength(1);

    expect(() => result.current.addSpaceMention(makeSpace({ slug: null }))).toThrow(
      "Space has no slug set",
    );
  });

  it("resetSpaceMentions clears all mention state", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(
      (props: UseSpaceMentionsProps) => useSpaceMentions(props),
      {
        initialProps: {
          content: "hello #des",
          setContent: vi.fn(),
          focus: vi.fn(),
          cursorPosition: 10,
          isSelectionActive: false,
          debounceDelay: 10,
        },
      },
    );

    axiosPrivate.mockResponse("get", { data: [makeSpace()], pagination: { page: 1, pageSize: 5, totalPages: 1, totalItems: 1, hasMore: false } });
    await waitFor(() => expect(result.current.spaceMentionSuggestions).toHaveLength(1));

    act(() => {
      result.current.resetSpaceMentions();
    });

    expect(result.current.isSpaceMentionActive).toBe(false);
    expect(result.current.spaceMentionSuggestions).toEqual([]);
  });
});
