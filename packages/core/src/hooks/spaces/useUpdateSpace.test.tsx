import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeSpaceDetailed } from "../../test-utils";
import useUpdateSpace from "./useUpdateSpace";

afterEach(() => {
  resetAxiosMocks();
});

describe("useUpdateSpace", () => {
  it("updates a space via a plain JSON request when there are no image uploads", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateSpace());

    const updated = makeSpaceDetailed({ name: "New name" });
    axiosPrivate.mockResponse("patch", updated);

    let returned;
    await act(async () => {
      returned = await result.current({
        spaceId: "space-1",
        update: { name: "New name" },
      });
    });

    expect(returned).toEqual(updated);

    const [call] = axiosPrivate.calls("patch");
    expect(call.url).toBe("/test-project/spaces/space-1");
    expect(call.body).toEqual({ name: "New name" });
  });

  it("updates a space via multipart FormData when a banner is provided", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateSpace());

    axiosPrivate.mockResponse("patch", makeSpaceDetailed());

    const file = new File(["binary"], "banner.png", { type: "image/png" });

    await act(async () => {
      await result.current({
        spaceId: "space-1",
        update: {
          name: "New name",
          banner: { file, options: { mode: "original-aspect", sizes: { full: 1200 } } },
        },
      });
    });

    const [call] = axiosPrivate.calls("patch");
    expect(call.body instanceof FormData).toBe(true);
    const formData = call.body as FormData;
    expect(formData.get("name")).toBe("New name");
    expect(formData.get("bannerFile")).toBeInstanceOf(File);
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateSpace());

    axiosPrivate.mockError("patch", 500, { message: "Internal error" });

    await expect(
      result.current({ spaceId: "space-1", update: { name: "New name" } }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when no space ID is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateSpace());

    await expect(
      result.current({ spaceId: "", update: { name: "New name" } }),
    ).rejects.toThrow("Please pass a spaceId");
    expect(axiosPrivate.calls("patch")).toHaveLength(0);
  });
});
