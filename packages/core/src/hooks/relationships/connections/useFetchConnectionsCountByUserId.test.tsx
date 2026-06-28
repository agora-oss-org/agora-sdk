import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../../test-utils";
import useFetchConnectionsCountByUserId from "./useFetchConnectionsCountByUserId";

afterEach(() => {
  resetAxiosMocks();
});

describe("useFetchConnectionsCountByUserId", () => {
  it("fetches another user's connections count", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchConnectionsCountByUserId(),
    );

    axiosPublic.mockResponse("get", { count: 3 });

    let returned;
    await act(async () => {
      returned = await result.current({ userId: "user-2" });
    });

    expect(returned).toEqual({ count: 3 });

    const [call] = axiosPublic.calls("get");
    expect(call.url).toBe("/users/user-2/connections-count");
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchConnectionsCountByUserId(),
    );

    axiosPublic.mockError("get", 500, { message: "Internal error" });

    await expect(
      result.current({ userId: "user-2" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when no user ID is passed", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchConnectionsCountByUserId(),
    );

    await expect(result.current({ userId: "" })).rejects.toThrow(
      "No user ID was provided",
    );
    expect(axiosPublic.calls("get")).toHaveLength(0);
  });
});
