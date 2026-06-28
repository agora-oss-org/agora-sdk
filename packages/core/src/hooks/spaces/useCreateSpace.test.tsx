import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeSpace } from "../../test-utils";
import useCreateSpace from "./useCreateSpace";

afterEach(() => {
  resetAxiosMocks();
});

describe("useCreateSpace", () => {
  it("creates a space via a plain JSON request when there are no image uploads", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useCreateSpace());

    const created = makeSpace({ name: "Design" });
    axiosPrivate.mockResponse("post", created, 201);

    let returned: typeof created | undefined;
    await act(async () => {
      returned = await result.current({ name: "Design" });
    });

    expect(returned).toEqual(created);

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe("/test-project/spaces");
    expect(call.body).toMatchObject({ name: "Design" });
    expect(call.body instanceof FormData).toBe(false);
  });

  it("creates a space via multipart FormData when an avatar is provided", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useCreateSpace());

    axiosPrivate.mockResponse("post", makeSpace(), 201);

    const file = new File(["binary"], "avatar.png", { type: "image/png" });

    await act(async () => {
      await result.current({
        name: "Design",
        avatar: { file, options: { mode: "original-aspect", sizes: { full: 256 } } },
      });
    });

    const [call] = axiosPrivate.calls("post");
    expect(call.body instanceof FormData).toBe(true);
    const formData = call.body as FormData;
    expect(formData.get("name")).toBe("Design");
    expect(formData.get("avatarFile")).toBeInstanceOf(File);
    expect(formData.get("avatarFile.options")).toBe(
      JSON.stringify({ mode: "original-aspect", sizes: { full: 256 } }),
    );
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useCreateSpace());

    axiosPrivate.mockError("post", 500, { message: "Internal error" });

    await expect(result.current({ name: "Design" })).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it("throws before making a request when no name is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useCreateSpace());

    await expect(result.current({ name: "" })).rejects.toThrow(
      "Space name is required",
    );
    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });

  it("throws before making a request when there is no project", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useCreateSpace(), {
      projectId: "",
    });

    await expect(result.current({ name: "Design" })).rejects.toThrow(
      "No projectId available.",
    );
    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });
});
