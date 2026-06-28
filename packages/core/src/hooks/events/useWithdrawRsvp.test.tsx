import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeEvent } from "../../test-utils";
import useWithdrawRsvp from "./useWithdrawRsvp";

afterEach(() => {
  resetAxiosMocks();
});

describe("useWithdrawRsvp", () => {
  it("withdraws the RSVP from the event", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useWithdrawRsvp());

    const event = makeEvent({ userRsvp: null });
    axiosPrivate.mockResponse("delete", event);

    let returned: typeof event | undefined;
    await act(async () => {
      returned = await result.current({ eventId: "event-1" });
    });

    expect(returned).toEqual(event);

    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/events/event-1/rsvp");
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useWithdrawRsvp());

    axiosPrivate.mockError("delete", 500, { message: "Internal error" });

    await expect(
      result.current({ eventId: "event-1" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when there is no project", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useWithdrawRsvp(), {
      projectId: "",
    });

    await expect(result.current({ eventId: "event-1" })).rejects.toThrow(
      "No projectId available.",
    );
    expect(axiosPrivate.calls("delete")).toHaveLength(0);
  });
});
