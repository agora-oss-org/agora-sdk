import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useEntityComments from "./useEntityComments";
import { makeComment } from "./testHelpers";
import type { PaginatedResponse } from "../../interfaces/PaginatedResponse";
import type { Comment } from "../../interfaces/models/Comment";

afterEach(() => {
  resetAxiosMocks();
});

function makePage(comments: Comment[], hasMore: boolean): PaginatedResponse<Comment> {
  return {
    data: comments,
    pagination: {
      page: 1,
      pageSize: 10,
      totalPages: hasMore ? 2 : 1,
      totalItems: comments.length,
      hasMore,
    },
  };
}

describe("useEntityComments", () => {
  it("loads root comments into the tree and loads more on demand", async () => {
    const rootComment = makeComment({ id: "comment-1" });
    const secondComment = makeComment({ id: "comment-2" });

    const { result, axiosPrivate } = renderHookWithAxios(
      () => useEntityComments({ entityId: "entity-1" }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", makePage([rootComment], true)),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments).toEqual([rootComment]);
    expect(result.current.entityCommentsTree["comment-1"]).toMatchObject({
      comment: rootComment,
      new: false,
    });

    axiosPrivate.mockResponse("get", makePage([secondComment], false));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.comments.map((c) => c.id)).toEqual([
      "comment-1",
      "comment-2",
    ]);
  });

  it("marks newly added root comments as new and sorts them most-recent-first", async () => {
    const { result } = renderHookWithAxios(
      () => useEntityComments({ entityId: "entity-1" }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", makePage([], false)),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.addCommentsToTree(
        [
          makeComment({ id: "new-1", createdAt: "2024-01-01T00:00:00.000Z" }),
          makeComment({ id: "new-2", createdAt: "2024-01-02T00:00:00.000Z" }),
        ],
        true,
      );
    });

    expect(result.current.newComments.map((c) => c.id)).toEqual(["new-2", "new-1"]);
  });

  it("removes a comment from the tree", async () => {
    const { result } = renderHookWithAxios(
      () => useEntityComments({ entityId: "entity-1" }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", makePage([], false)),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.addCommentsToTree([makeComment({ id: "comment-1" })]);
    });
    expect(result.current.comments).toHaveLength(1);

    act(() => {
      result.current.removeCommentFromTree({ commentId: "comment-1" });
    });
    expect(result.current.comments).toHaveLength(0);
  });

  it("stops loading without throwing when the request fails", async () => {
    const { result } = renderHookWithAxios(
      () => useEntityComments({ entityId: "entity-1" }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockError("get", 500, { message: "Internal error" }),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments).toEqual([]);
  });

  it("does not fetch when there is no entity ID", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useEntityComments({ entityId: null }),
    );

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(axiosPrivate.calls("get")).toHaveLength(0);
  });
});
