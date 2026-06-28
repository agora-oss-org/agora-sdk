import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useFetchManyCommentsWrapper from "./useFetchManyCommentsWrapper";
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

describe("useFetchManyCommentsWrapper", () => {
  it("fetches the first page on mount and loads more on demand", async () => {
    const firstComment = makeComment({ id: "comment-1" });
    const secondComment = makeComment({ id: "comment-2" });

    const { result, axiosPrivate } = renderHookWithAxios(
      () => useFetchManyCommentsWrapper({ entityId: "entity-1" }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", makePage([firstComment], true)),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments).toEqual([firstComment]);
    expect(result.current.hasMore).toBe(true);

    axiosPrivate.mockResponse("get", makePage([secondComment], false));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.comments).toEqual([firstComment, secondComment]);

    const calls = axiosPrivate.calls("get");
    expect(calls).toHaveLength(2);
    expect(calls[0].config?.params).toMatchObject({ page: 1, entityId: "entity-1" });
    expect(calls[1].config?.params).toMatchObject({ page: 2, entityId: "entity-1" });
  });

  it("does not fetch when no entity/user/parent ID is given", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useFetchManyCommentsWrapper({}),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
    expect(axiosPrivate.calls("get")).toHaveLength(0);
  });

  it("stops loading without throwing when the request fails", async () => {
    const { result } = renderHookWithAxios(
      () => useFetchManyCommentsWrapper({ entityId: "entity-1" }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockError("get", 500, { message: "Internal error" }),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments).toEqual([]);
  });
});
