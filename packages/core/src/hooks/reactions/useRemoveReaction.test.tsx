import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeEntity, makeComment } from "../../test-utils";
import useRemoveReaction from "./useRemoveReaction";

afterEach(() => {
  resetAxiosMocks();
});

describe("useRemoveReaction", () => {
  it("removes a reaction from an entity", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useRemoveReaction());

    const entity = makeEntity({ userReaction: null });
    axiosPrivate.mockResponse("delete", entity);

    let returned;
    await act(async () => {
      returned = await result.current({ targetType: "entity", targetId: "entity-1" });
    });

    expect(returned).toEqual(entity);

    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/entities/entity-1/reactions");
  });

  it("removes a reaction from a comment", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useRemoveReaction());

    const comment = makeComment({ userReaction: null });
    axiosPrivate.mockResponse("delete", comment);

    await act(async () => {
      await result.current({ targetType: "comment", targetId: "comment-1" });
    });

    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/comments/comment-1/reactions");
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useRemoveReaction());

    axiosPrivate.mockError("delete", 500, { message: "Internal error" });

    await expect(
      result.current({ targetType: "entity", targetId: "entity-1" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when no target ID is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useRemoveReaction());

    await expect(
      result.current({ targetType: "entity", targetId: "" }),
    ).rejects.toThrow("No target ID provided");
    expect(axiosPrivate.calls("delete")).toHaveLength(0);
  });
});
