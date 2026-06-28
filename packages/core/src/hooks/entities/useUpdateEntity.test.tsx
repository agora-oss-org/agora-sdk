import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeEntity } from "../../test-utils";
import useUpdateEntity from "./useUpdateEntity";

afterEach(() => {
  resetAxiosMocks();
});

describe("useUpdateEntity", () => {
  it("updates the entity and returns the server response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateEntity());

    const updated = makeEntity({ title: "New title" });
    axiosPrivate.mockResponse("patch", updated);

    let returned: typeof updated | undefined;
    await act(async () => {
      returned = await result.current({
        entityId: "entity-1",
        update: { title: "New title" },
      });
    });

    expect(returned).toEqual(updated);

    const [call] = axiosPrivate.calls("patch");
    expect(call.url).toBe("/test-project/entities/entity-1");
    expect(call.body).toMatchObject({ title: "New title" });
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateEntity());

    axiosPrivate.mockError("patch", 500, { message: "Internal error" });

    await expect(
      result.current({ entityId: "entity-1", update: { title: "New title" } }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when there is no project", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateEntity(), {
      projectId: "",
    });

    await expect(
      result.current({ entityId: "entity-1", update: { title: "New title" } }),
    ).rejects.toThrow("No projectId available.");
    expect(axiosPrivate.calls("patch")).toHaveLength(0);
  });
});
