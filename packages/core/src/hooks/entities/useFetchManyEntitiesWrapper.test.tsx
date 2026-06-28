import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeEntity } from "../../test-utils";
import useFetchManyEntitiesWrapper from "./useFetchManyEntitiesWrapper";
import type { PaginatedResponse } from "../../interfaces/PaginatedResponse";
import type { Entity } from "../../interfaces/models/Entity";

afterEach(() => {
  resetAxiosMocks();
});

function makePage(entities: Entity[], hasMore: boolean): PaginatedResponse<Entity> {
  return {
    data: entities,
    pagination: {
      page: 1,
      pageSize: 10,
      totalPages: hasMore ? 2 : 1,
      totalItems: entities.length,
      hasMore,
    },
  };
}

describe("useFetchManyEntitiesWrapper", () => {
  it("fetches the first page on mount and loads more on demand", async () => {
    const firstEntity = makeEntity({ id: "entity-1" });
    const secondEntity = makeEntity({ id: "entity-2" });

    const { result, axiosPrivate } = renderHookWithAxios(
      () => useFetchManyEntitiesWrapper({}),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", makePage([firstEntity], true)),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entities).toEqual([firstEntity]);
    expect(result.current.hasMore).toBe(true);

    axiosPrivate.mockResponse("get", makePage([secondEntity], false));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.entities).toEqual([firstEntity, secondEntity]);

    const calls = axiosPrivate.calls("get");
    expect(calls).toHaveLength(2);
    expect(calls[0].config?.params).toMatchObject({ page: 1 });
    expect(calls[1].config?.params).toMatchObject({ page: 2 });
  });

  it("resets to page 1 and refetches when the sort options change", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(
      () => useFetchManyEntitiesWrapper({}),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockResponse("get", makePage([makeEntity()], false)),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    axiosPrivate.mockResponse("get", makePage([], false));

    act(() => {
      result.current.setSortBy("top");
    });

    await waitFor(() => expect(result.current.sortBy).toBe("top"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const calls = axiosPrivate.calls("get");
    const lastCall = calls[calls.length - 1];
    expect(lastCall.config?.params).toMatchObject({ page: 1, sortBy: "top" });
  });

  it("stops loading without throwing when the request fails", async () => {
    const { result } = renderHookWithAxios(() => useFetchManyEntitiesWrapper({}), {
      beforeRender: ({ axiosPrivate }) =>
        axiosPrivate.mockError("get", 500, { message: "Internal error" }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entities).toEqual([]);
  });
});
