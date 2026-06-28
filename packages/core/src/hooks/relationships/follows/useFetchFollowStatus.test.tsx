import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeAuthUser } from "../../../test-utils";
import useFetchFollowStatus from "./useFetchFollowStatus";

afterEach(() => {
  resetAxiosMocks();
});

describe("useFetchFollowStatus", () => {
  it("fetches the follow status with another user", async () => {
    const user = makeAuthUser({ id: "user-1" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useFetchFollowStatus(), { user });

    axiosPrivate.mockResponse("get", { isFollowing: true, followId: "follow-1", followedAt: "2024-01-01T00:00:00.000Z" });

    let returned;
    await act(async () => {
      returned = await result.current({ userId: "user-2" });
    });

    expect(returned).toEqual({ isFollowing: true, followId: "follow-1", followedAt: "2024-01-01T00:00:00.000Z" });

    const [call] = axiosPrivate.calls("get");
    expect(call.url).toBe("/test-project/users/user-2/follow");
  });

  it("rejects when the server returns an error response", async () => {
    const user = makeAuthUser({ id: "user-1" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useFetchFollowStatus(), { user });

    axiosPrivate.mockError("get", 500, { message: "Internal error" });

    await expect(
      result.current({ userId: "user-2" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when checking status with yourself", async () => {
    const user = makeAuthUser({ id: "user-1" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useFetchFollowStatus(), { user });

    await expect(result.current({ userId: "user-1" })).rejects.toThrow(
      "Users don't follow themselves",
    );
    expect(axiosPrivate.calls("get")).toHaveLength(0);
  });

  it("throws before making a request when there is no authenticated user", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useFetchFollowStatus());

    await expect(result.current({ userId: "user-2" })).rejects.toThrow(
      "No user is logged in",
    );
    expect(axiosPrivate.calls("get")).toHaveLength(0);
  });
});
