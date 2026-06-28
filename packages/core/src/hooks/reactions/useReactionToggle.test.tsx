import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeEntity } from "../../test-utils";
import useReactionToggle from "./useReactionToggle";

afterEach(() => {
  resetAxiosMocks();
});

describe("useReactionToggle", () => {
  it("adds a reaction when there is no current reaction", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useReactionToggle({ targetType: "entity", targetId: "entity-1" }),
    );

    const updated = makeEntity({
      userReaction: "upvote",
      reactionCounts: { upvote: 1, downvote: 0, like: 0, love: 0, wow: 0, sad: 0, angry: 0, funny: 0 },
    });
    axiosPrivate.mockResponse("post", updated);

    await act(async () => {
      await result.current.toggleReaction({ reactionType: "upvote" });
    });

    expect(result.current.currentReaction).toBe("upvote");
    expect(result.current.reactionCounts).toEqual(updated.reactionCounts);

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe("/test-project/entities/entity-1/reactions");
    expect(call.body).toEqual({ reactionType: "upvote" });
  });

  it("removes the reaction when toggling the same type again", async () => {
    // Hoisted so the same object reference survives every re-render — an
    // inline literal here would look "changed" to the hook's effect deps on
    // every render and re-trigger the reset effect in an infinite loop.
    const initialReactionCounts = {
      upvote: 1, downvote: 0, like: 0, love: 0, wow: 0, sad: 0, angry: 0, funny: 0,
    };
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useReactionToggle({
        targetType: "entity",
        targetId: "entity-1",
        initialReaction: "upvote",
        initialReactionCounts,
      }),
    );

    const updated = makeEntity({
      userReaction: null,
      reactionCounts: { upvote: 0, downvote: 0, like: 0, love: 0, wow: 0, sad: 0, angry: 0, funny: 0 },
    });
    axiosPrivate.mockResponse("delete", updated);

    await act(async () => {
      await result.current.toggleReaction({ reactionType: "upvote" });
    });

    expect(result.current.currentReaction).toBeNull();
    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/entities/entity-1/reactions");
  });

  it("switches from one reaction type to another in a single call", async () => {
    const initialReactionCounts = {
      upvote: 1, downvote: 0, like: 0, love: 0, wow: 0, sad: 0, angry: 0, funny: 0,
    };
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useReactionToggle({
        targetType: "entity",
        targetId: "entity-1",
        initialReaction: "upvote",
        initialReactionCounts,
      }),
    );

    const updated = makeEntity({
      userReaction: "love",
      reactionCounts: { upvote: 0, downvote: 0, like: 0, love: 1, wow: 0, sad: 0, angry: 0, funny: 0 },
    });
    axiosPrivate.mockResponse("post", updated);

    await act(async () => {
      await result.current.toggleReaction({ reactionType: "love" });
    });

    expect(result.current.currentReaction).toBe("love");
    expect(result.current.reactionCounts).toEqual(updated.reactionCounts);

    const [call] = axiosPrivate.calls("post");
    expect(call.body).toEqual({ reactionType: "love" });
  });

  it("reverts the optimistic update when the request fails", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useReactionToggle({ targetType: "entity", targetId: "entity-1" }),
    );

    axiosPrivate.mockError("post", 500, { message: "Internal error" });

    let returned;
    await act(async () => {
      returned = await result.current.toggleReaction({ reactionType: "upvote" });
    });

    expect(returned).toBeNull();
    expect(result.current.currentReaction).toBeNull();
    expect(result.current.reactionCounts).toEqual({});
  });

  it("returns null without calling the API when there is no target ID", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useReactionToggle({ targetType: "entity", targetId: undefined }),
    );

    let returned;
    await act(async () => {
      returned = await result.current.toggleReaction({ reactionType: "upvote" });
    });

    expect(returned).toBeNull();
    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });
});
