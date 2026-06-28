import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useRemoveMember from "./useRemoveMember";

afterEach(() => {
  resetAxiosMocks();
});

describe("useRemoveMember", () => {
  it("removes a member from the space", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useRemoveMember());

    axiosPrivate.mockResponse("delete", { message: "Removed" });

    let returned;
    await act(async () => {
      returned = await result.current({ spaceId: "space-1", memberId: "membership-1" });
    });

    expect(returned).toEqual({ message: "Removed" });

    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/spaces/space-1/members/membership-1");
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useRemoveMember());

    axiosPrivate.mockError("delete", 403, { message: "Forbidden" });

    await expect(
      result.current({ spaceId: "space-1", memberId: "membership-1" }),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it("throws before making a request when required fields are missing", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useRemoveMember());

    await expect(
      result.current({ spaceId: "space-1", memberId: "" }),
    ).rejects.toThrow("spaceId and memberId are required");
    expect(axiosPrivate.calls("delete")).toHaveLength(0);
  });
});
