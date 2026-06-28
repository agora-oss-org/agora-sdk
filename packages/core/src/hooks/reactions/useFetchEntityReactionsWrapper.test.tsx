import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeReaction } from "../../test-utils";
import useFetchEntityReactionsWrapper from "./useFetchEntityReactionsWrapper";
import type { PaginatedResponse } from "../../interfaces/PaginatedResponse";
import type { Reaction } from "../../interfaces/models/Reaction";

afterEach(() => {
  resetAxiosMocks();
});

function makePage(reactions: Reaction[], hasMore: boolean): PaginatedResponse<Reaction> {
  return {
    data: reactions,
    pagination: {
      page: 1,
      pageSize: 20,
      totalPages: hasMore ? 2 : 1,
      totalItems: reactions.length,
      hasMore,
    },
  };
}

describe("useFetchEntityReactionsWrapper", () => {
  it("does not fetch on mount when autoFetch is false (the default)", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchEntityReactionsWrapper({ entityId: "entity-1" }),
    );

    expect(result.current.loading).toBe(false);
    expect(axiosPublic.calls("get")).toHaveLength(0);
  });

  it("fetches on mount when autoFetch is true, and loads more on demand", async () => {
    const firstReaction = makeReaction({ id: "reaction-1" });
    const secondReaction = makeReaction({ id: "reaction-2" });

    const { result, axiosPublic } = renderHookWithAxios(
      () => useFetchEntityReactionsWrapper({ entityId: "entity-1", autoFetch: true }),
      {
        beforeRender: ({ axiosPublic }) =>
          axiosPublic.mockResponse("get", makePage([firstReaction], true)),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reactions).toEqual([firstReaction]);

    axiosPublic.mockResponse("get", makePage([secondReaction], false));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.reactions).toEqual([firstReaction, secondReaction]);
  });

  it("refetch() re-runs the query from page 1", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchEntityReactionsWrapper({ entityId: "entity-1" }),
    );

    axiosPublic.mockResponse("get", makePage([makeReaction()], false));

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.reactions).toHaveLength(1));
  });

  it("stops loading without throwing when the request fails", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchEntityReactionsWrapper({ entityId: "entity-1" }),
    );

    axiosPublic.mockError("get", 500, { message: "Internal error" });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reactions).toEqual([]);
  });
});
