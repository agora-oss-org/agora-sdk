import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeEntity, makeComment } from "../../test-utils";
import useAddReaction from "./useAddReaction";

afterEach(() => {
  resetAxiosMocks();
});

describe("useAddReaction", () => {
  it("adds a reaction to an entity", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useAddReaction());

    const entity = makeEntity({ userReaction: "upvote" });
    axiosPrivate.mockResponse("post", entity);

    let returned;
    await act(async () => {
      returned = await result.current({
        targetType: "entity",
        targetId: "entity-1",
        reactionType: "upvote",
      });
    });

    expect(returned).toEqual(entity);

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe("/test-project/entities/entity-1/reactions");
    expect(call.body).toEqual({ reactionType: "upvote" });
  });

  it("adds a reaction to a comment", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useAddReaction());

    const comment = makeComment({ userReaction: "love" });
    axiosPrivate.mockResponse("post", comment);

    await act(async () => {
      await result.current({
        targetType: "comment",
        targetId: "comment-1",
        reactionType: "love",
      });
    });

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe("/test-project/comments/comment-1/reactions");
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useAddReaction());

    axiosPrivate.mockError("post", 500, { message: "Internal error" });

    await expect(
      result.current({ targetType: "entity", targetId: "entity-1", reactionType: "upvote" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when no target ID is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useAddReaction());

    await expect(
      result.current({ targetType: "entity", targetId: "", reactionType: "upvote" }),
    ).rejects.toThrow("No target ID provided");
    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });

  it("throws before making a request when no reaction type is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useAddReaction());

    await expect(
      result.current({ targetType: "entity", targetId: "entity-1", reactionType: "" as any }),
    ).rejects.toThrow("No reaction type provided");
    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });
});
