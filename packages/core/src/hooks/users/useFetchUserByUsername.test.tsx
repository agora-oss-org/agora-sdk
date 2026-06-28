import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeUser } from "../../test-utils";
import useFetchUserByUsername from "./useFetchUserByUsername";

afterEach(() => {
  resetAxiosMocks();
});

describe("useFetchUserByUsername", () => {
  it("fetches a user by username", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchUserByUsername(),
    );

    const user = makeUser({ username: "alice" });
    axiosPublic.mockResponse("get", user);

    let returned: typeof user | undefined;
    await act(async () => {
      returned = await result.current({ username: "alice" });
    });

    expect(returned).toEqual(user);

    const [call] = axiosPublic.calls("get");
    expect(call.url).toBe("/test-project/users/by-username");
    expect(call.config?.params).toMatchObject({ username: "alice" });
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchUserByUsername(),
    );

    axiosPublic.mockError("get", 404, { message: "Not found" });

    await expect(
      result.current({ username: "alice" }),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it("throws before making a request when no username is passed", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useFetchUserByUsername(),
    );

    await expect(result.current({ username: "" })).rejects.toThrow(
      "Please specify a username",
    );
    expect(axiosPublic.calls("get")).toHaveLength(0);
  });
});
