import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeEvent } from "../../test-utils";
import useEventData, { type UseEventDataProps } from "./useEventData";

afterEach(() => {
  resetAxiosMocks();
});

describe("useEventData", () => {
  it("resolves an event by eventId and caches it for the same ID on a later render", async () => {
    const eventOne = makeEvent({ id: "event-1" });
    const eventTwo = makeEvent({ id: "event-2" });

    const { result, rerender, axiosPrivate } = renderHookWithAxios(
      (props: UseEventDataProps) => useEventData(props),
      {
        initialProps: { eventId: "event-1" } as UseEventDataProps,
        beforeRender: ({ axiosPrivate }) => axiosPrivate.mockResponse("get", eventOne),
      },
    );

    await waitFor(() => expect(result.current.event).toEqual(eventOne));

    axiosPrivate.mockResponse("get", eventTwo);
    rerender({ eventId: "event-2" } as UseEventDataProps);
    await waitFor(() => expect(result.current.event).toEqual(eventTwo));

    rerender({ eventId: "event-1" } as UseEventDataProps);
    await waitFor(() => expect(result.current.event).toEqual(eventOne));

    expect(axiosPrivate.calls("get")).toHaveLength(2);
  });

  it("uses a directly-provided event prop without fetching", () => {
    const event = makeEvent({ id: "event-1" });

    const { result, axiosPrivate } = renderHookWithAxios(() =>
      useEventData({ event }),
    );

    expect(result.current.event).toEqual(event);
    expect(axiosPrivate.calls("get")).toHaveLength(0);
  });

  it("does not throw and leaves event unset when the fetch fails", async () => {
    const { result } = renderHookWithAxios(
      () => useEventData({ eventId: "event-1" }),
      {
        beforeRender: ({ axiosPrivate }) =>
          axiosPrivate.mockError("get", 500, { message: "Internal error" }),
      },
    );

    await waitFor(() => expect(result.current.event).toBeUndefined());
  });

  it("updates the event via updateEvent", async () => {
    const event = makeEvent({ id: "event-1", title: "Old" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useEventData({ event }));

    const updated = { ...event, title: "New" };
    axiosPrivate.mockResponse("patch", updated);

    let returned;
    await act(async () => {
      returned = await result.current.updateEvent({ update: { title: "New" } });
    });

    expect(returned).toEqual(updated);
    expect(result.current.event).toEqual(updated);
  });

  it("no-ops updateEvent when there is no event yet", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useEventData({} as any));

    let returned;
    await act(async () => {
      returned = await result.current.updateEvent({ update: { title: "New" } });
    });

    expect(returned).toBeUndefined();
    expect(axiosPrivate.calls("patch")).toHaveLength(0);
  });

  it("deletes the event via deleteEvent and clears local state", async () => {
    const event = makeEvent({ id: "event-1" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useEventData({ event }));

    axiosPrivate.mockResponse("delete", undefined, 204);

    await act(async () => {
      await result.current.deleteEvent();
    });

    expect(result.current.event).toBeUndefined();
    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/events/event-1");
  });

  it("cancels the event via cancelEvent", async () => {
    const event = makeEvent({ id: "event-1", status: "active" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useEventData({ event }));

    const cancelled = { ...event, status: "cancelled" as const };
    axiosPrivate.mockResponse("post", cancelled);

    let returned;
    await act(async () => {
      returned = await result.current.cancelEvent();
    });

    expect(returned).toEqual(cancelled);
    expect(result.current.event).toEqual(cancelled);
  });

  it("sets and withdraws an RSVP", async () => {
    const event = makeEvent({ id: "event-1" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useEventData({ event }));

    const goingEvent = { ...event, userRsvp: "going" as const };
    axiosPrivate.mockResponse("post", goingEvent);

    await act(async () => {
      await result.current.setRsvp("going");
    });
    expect(result.current.event).toEqual(goingEvent);

    const withdrawnEvent = { ...event, userRsvp: null };
    axiosPrivate.mockResponse("delete", withdrawnEvent);

    await act(async () => {
      await result.current.withdrawRsvp();
    });
    expect(result.current.event).toEqual(withdrawnEvent);
  });

  it("does not throw when updateEvent's request fails", async () => {
    const event = makeEvent({ id: "event-1" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useEventData({ event }));

    axiosPrivate.mockError("patch", 500, { message: "Internal error" });

    await expect(
      act(async () => {
        await result.current.updateEvent({ update: { title: "New" } });
      }),
    ).resolves.not.toThrow();
  });
});
