import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { waitFor, act, cleanup } from "@testing-library/react";

import {
  renderHookWithStore,
  stubFetchMock,
  unstubFetchMock,
  jsonResponse,
  type FetchMockHandle,
} from "../../test-utils";
import { useTable } from "./useTable";

const ROWS = [
  { id: "1", name: "alpha" },
  { id: "2", name: "bravo" },
];

let fetchHandle: FetchMockHandle;

beforeEach(() => {
  fetchHandle = stubFetchMock(async (...args: unknown[]) => {
    const req = args[0] as Request | string;
    const url = typeof req === "string" ? req : req.url;
    const method =
      (typeof req === "string"
        ? (args[1] as RequestInit | undefined)?.method
        : (req as Request).method) ?? "GET";

    if (method === "GET" && url.includes("/db/Events")) {
      return jsonResponse({
        data: ROWS,
        pagination: {
          page: 1,
          pageSize: 20,
          totalPages: 1,
          totalItems: 2,
          hasMore: false,
        },
      });
    }
    if (method === "POST" && url.includes("/restore")) {
      return jsonResponse({ row: { id: "1", name: "alpha", deletedAt: null } });
    }
    if (method === "POST" && url.includes("/db/Events")) {
      return jsonResponse({ row: { id: "3", name: "charlie" } }, 201);
    }
    if (method === "PATCH" && url.includes("/db/Events/1")) {
      return jsonResponse({ row: { id: "1", name: "updated" } });
    }
    if (method === "DELETE" && url.includes("/db/Events/1")) {
      return jsonResponse({ deleted: true, soft: !url.includes("force=true") });
    }
    return jsonResponse({}, 404);
  });
});

afterEach(() => {
  cleanup();
  unstubFetchMock();
});

describe("useTable", () => {
  it("loads rows from the /db surface", async () => {
    const { result } = renderHookWithStore(() => useTable("Events"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(result.current.pagination?.totalItems).toBe(2);

    // The GET hit the logical-name /db route.
    const getCall = fetchHandle
      .calls()
      .find((c) => c.url.includes("/test-project/db/Events"));
    expect(getCall).toBeTruthy();
  });

  it("createRow issues a POST and returns the new row", async () => {
    const { result } = renderHookWithStore(() => useTable("Events"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.createRow({ name: "charlie" });
    });
    expect(created?.id).toBe("3");

    const postCall = fetchHandle.calls().find((c) => c.method === "POST");
    expect(postCall).toBeTruthy();
  });

  it("exposes view controls that update the slice", async () => {
    const { result } = renderHookWithStore(() => useTable("Events"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setIncludeDeleted(true));
    await waitFor(() =>
      expect(result.current.view.includeDeleted).toBe(true),
    );
    expect(result.current.view.page).toBe(1);
  });

  it("setPage updates the page without resetting other view state", async () => {
    const { result } = renderHookWithStore(() => useTable("Events"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilters([{ column: "name", operator: "eq", value: "alpha" }]));
    await waitFor(() => expect(result.current.view.filters).toHaveLength(1));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.view.page).toBe(3));
    expect(result.current.view.filters).toHaveLength(1);
  });

  it("setSort resets the page to 1", async () => {
    const { result } = renderHookWithStore(() => useTable("Events"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(5));
    await waitFor(() => expect(result.current.view.page).toBe(5));

    act(() => result.current.setSort("name", "desc"));
    await waitFor(() => expect(result.current.view.sortBy).toBe("name"));
    expect(result.current.view.sortDir).toBe("desc");
    expect(result.current.view.page).toBe(1);
  });

  it("updateRow issues a PATCH and returns the updated row", async () => {
    const { result } = renderHookWithStore(() =>
      useTable<{ id: string; name: string }>("Events"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    let updated: { id: string; name: string } | undefined;
    await act(async () => {
      updated = await result.current.updateRow("1", { name: "updated" });
    });
    expect(updated?.name).toBe("updated");

    const patchCall = fetchHandle.calls().find((c) => c.method === "PATCH");
    expect(patchCall?.url).toContain("/db/Events/1");
  });

  it("deleteRow issues a DELETE and reports soft-delete by default", async () => {
    const { result } = renderHookWithStore(() => useTable("Events"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: { deleted: boolean; soft: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.deleteRow("1");
    });
    expect(outcome).toEqual({ deleted: true, soft: true });

    const deleteCall = fetchHandle.calls().find((c) => c.method === "DELETE");
    expect(deleteCall?.url).toContain("/db/Events/1");
  });

  it("deleteRow forwards force:true through to the request", async () => {
    const { result } = renderHookWithStore(() => useTable("Events"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteRow("1", { force: true });
    });

    const deleteCall = fetchHandle.calls().find((c) => c.method === "DELETE");
    expect(deleteCall?.url).toContain("force=true");
  });

  it("restoreRow issues a POST to the row's /restore route", async () => {
    const { result } = renderHookWithStore(() =>
      useTable<{ id: string; deletedAt: string | null }>("Events"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    let restored: { id: string; deletedAt: string | null } | undefined;
    await act(async () => {
      restored = await result.current.restoreRow("1");
    });
    expect(restored?.deletedAt).toBeNull();

    const restoreCall = fetchHandle.calls().find((c) => c.url.includes("/restore"));
    expect(restoreCall?.method).toBe("POST");
  });

  it("surfaces a fetch error instead of throwing", async () => {
    fetchHandle.fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ message: "server error" }, 500),
    );
    const { result } = renderHookWithStore(() => useTable("Events"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });

  it("createRow rejects when the request fails", async () => {
    const { result } = renderHookWithStore(() => useTable("Events"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchHandle.fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ message: "invalid" }, 400),
    );

    await expect(
      act(async () => {
        await result.current.createRow({ name: "broken" });
      }),
    ).rejects.toBeTruthy();
  });
});
