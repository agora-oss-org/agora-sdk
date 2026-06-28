import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useUnbanMember from "./useUnbanMember";

afterEach(() => {
  resetAxiosMocks();
});

describe("useUnbanMember", () => {
  it("unbans a member", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUnbanMember());

    const response = {
      message: "Unbanned",
      membership: {
        id: "membership-1",
        projectId: "test-project",
        spaceId: "space-1",
        userId: "user-2",
        role: "member" as const,
        status: "active" as const,
        joinedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    };
    axiosPrivate.mockResponse("patch", response);

    let returned;
    await act(async () => {
      returned = await result.current({ spaceId: "space-1", memberId: "membership-1" });
    });

    expect(returned).toEqual(response);

    const [call] = axiosPrivate.calls("patch");
    expect(call.url).toBe("/test-project/spaces/space-1/members/membership-1/unban");
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUnbanMember());

    axiosPrivate.mockError("patch", 403, { message: "Forbidden" });

    await expect(
      result.current({ spaceId: "space-1", memberId: "membership-1" }),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it("throws before making a request when required fields are missing", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUnbanMember());

    await expect(
      result.current({ spaceId: "space-1", memberId: "" }),
    ).rejects.toThrow("spaceId and memberId are required");
    expect(axiosPrivate.calls("patch")).toHaveLength(0);
  });
});
