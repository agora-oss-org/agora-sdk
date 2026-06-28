import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useApproveMember from "./useApproveMember";

afterEach(() => {
  resetAxiosMocks();
});

describe("useApproveMember", () => {
  it("approves a pending member", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useApproveMember());

    const response = {
      message: "Approved",
      membership: { id: "membership-1", status: "active" as const, joinedAt: "2024-01-01T00:00:00.000Z" },
    };
    axiosPrivate.mockResponse("patch", response);

    let returned;
    await act(async () => {
      returned = await result.current({ spaceId: "space-1", memberId: "membership-1" });
    });

    expect(returned).toEqual(response);

    const [call] = axiosPrivate.calls("patch");
    expect(call.url).toBe("/test-project/spaces/space-1/members/membership-1/approve");
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useApproveMember());

    axiosPrivate.mockError("patch", 403, { message: "Forbidden" });

    await expect(
      result.current({ spaceId: "space-1", memberId: "membership-1" }),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it("throws before making a request when required fields are missing", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useApproveMember());

    await expect(
      result.current({ spaceId: "space-1", memberId: "" }),
    ).rejects.toThrow("spaceId and memberId are required");
    expect(axiosPrivate.calls("patch")).toHaveLength(0);
  });
});
