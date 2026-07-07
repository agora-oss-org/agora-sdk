import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  makeRtkQueryStore,
  stubFetchMock,
  unstubFetchMock,
  jsonResponse,
  type FetchMockHandle,
  type RtkQueryStore,
} from "../../test-utils";
import { notificationPreferencesApi } from "./notificationPreferencesApi";

let fetchHandle: FetchMockHandle;
let store: RtkQueryStore;

/**
 * fetchBaseQuery builds `new Request(url, init)` and calls `fetch(request)`.
 * The test harness shims `Request` to a passthrough that stores `init` on the
 * instance, so the JSON body is reachable at `request.init.body`. This reads it
 * back so we can assert the exact wire payload (e.g. that the mute duration is
 * sent as the choice, never a timestamp).
 */
function bodyOf(args: unknown[]): unknown {
  const req = args[0] as { init?: { body?: unknown }; body?: unknown };
  const raw = req?.init?.body ?? req?.body ?? (args[1] as RequestInit)?.body;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

beforeEach(() => {
  fetchHandle = stubFetchMock(async () => jsonResponse({}, 404));
  store = makeRtkQueryStore();
});

afterEach(() => {
  unstubFetchMock();
});

describe("notificationPreferencesApi", () => {
  it("getNotificationPreferences issues a GET to the preferences route", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(
      jsonResponse({ disabledTypes: ["new-follow", "message"] }),
    );

    const result = await store.dispatch(
      notificationPreferencesApi.endpoints.getNotificationPreferences.initiate({
        projectId: "test-project",
      }),
    );

    const call = fetchHandle.calls()[0];
    expect(call.method).toBe("GET");
    expect(call.url).toContain("/test-project/push-notifications/preferences");
    expect(result.data?.disabledTypes).toEqual(["new-follow", "message"]);
  });

  it("updateNotificationPreferences issues a PUT with the disabledTypes body", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(
      jsonResponse({ disabledTypes: ["comment-mention"] }),
    );

    const result = await store.dispatch(
      notificationPreferencesApi.endpoints.updateNotificationPreferences.initiate({
        projectId: "test-project",
        disabledTypes: ["comment-mention"],
      }),
    );

    const call = fetchHandle.calls()[0];
    expect(call.method).toBe("PUT");
    expect(call.url).toContain("/test-project/push-notifications/preferences");
    expect(bodyOf(fetchHandle.fetchMock.mock.calls[0])).toEqual({
      disabledTypes: ["comment-mention"],
    });
    expect((result as { data?: { disabledTypes: string[] } }).data?.disabledTypes).toEqual([
      "comment-mention",
    ]);
  });

  it("updateNotificationPreferences optimistically updates the cached read", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({ disabledTypes: [] }));
    await store.dispatch(
      notificationPreferencesApi.endpoints.getNotificationPreferences.initiate({
        projectId: "test-project",
      }),
    );

    fetchHandle.fetchMock.mockResolvedValueOnce(
      jsonResponse({ disabledTypes: ["new-follow"] }),
    );
    await store.dispatch(
      notificationPreferencesApi.endpoints.updateNotificationPreferences.initiate({
        projectId: "test-project",
        disabledTypes: ["new-follow"],
      }),
    );

    const cached = notificationPreferencesApi.endpoints.getNotificationPreferences.select({
      projectId: "test-project",
    })(store.getState());
    expect(cached.data?.disabledTypes).toEqual(["new-follow"]);
  });

  it("muteConversation POSTs the duration choice (not a timestamp) to the mute route", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(
      jsonResponse({
        currentMember: {
          id: "m1",
          userId: "user-1",
          conversationId: "c1",
          mutedForever: true,
          mutedUntil: null,
        },
      }),
    );

    const result = await store.dispatch(
      notificationPreferencesApi.endpoints.muteConversation.initiate({
        projectId: "test-project",
        conversationId: "c1",
        duration: "forever",
      }),
    );

    const call = fetchHandle.calls()[0];
    expect(call.method).toBe("POST");
    expect(call.url).toContain("/test-project/chat/conversations/c1/mute");
    expect(bodyOf(fetchHandle.fetchMock.mock.calls[0])).toEqual({ duration: "forever" });
    expect(
      (result as { data?: { currentMember: { mutedForever: boolean } } }).data
        ?.currentMember.mutedForever,
    ).toBe(true);
  });

  it("muteConversation sends duration: null to clear a mute", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(
      jsonResponse({
        currentMember: {
          id: "m1",
          userId: "user-1",
          conversationId: "c1",
          mutedForever: false,
          mutedUntil: null,
        },
      }),
    );

    await store.dispatch(
      notificationPreferencesApi.endpoints.muteConversation.initiate({
        projectId: "test-project",
        conversationId: "c1",
        duration: null,
      }),
    );

    expect(bodyOf(fetchHandle.fetchMock.mock.calls[0])).toEqual({ duration: null });
  });

  it("surfaces a non-2xx response as a query error", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({ message: "boom" }, 500));

    const result = await store.dispatch(
      notificationPreferencesApi.endpoints.getNotificationPreferences.initiate({
        projectId: "test-project",
      }),
    );

    expect(result.isError).toBe(true);
    expect((result.error as { status: number }).status).toBe(500);
  });
});
