import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup } from "@testing-library/react";

import {
  renderHookWithStore,
  stubFetchMock,
  unstubFetchMock,
  jsonResponse,
  makeAuthUser,
  type FetchMockHandle,
} from "../../test-utils";
import { setUser } from "../../store/slices/authSlice";
import usePushRegistration from "./usePushRegistration";
import type { PushTokenAdapter } from "../../interfaces/PushTokenAdapter";

let fetchHandle: FetchMockHandle;

function makeAdapter(overrides: Partial<PushTokenAdapter> = {}): PushTokenAdapter {
  return {
    requestPermission: vi.fn().mockResolvedValue(true),
    getDeviceIdentifier: vi
      .fn()
      .mockResolvedValue({ platform: "ios", token: "device-token-1" }),
    ...overrides,
  };
}

beforeEach(() => {
  fetchHandle = stubFetchMock(async () => jsonResponse({}, 404));
});

afterEach(() => {
  cleanup();
  unstubFetchMock();
});

describe("usePushRegistration", () => {
  describe("register", () => {
    it("requests permission, fetches the identifier, and POSTs the device", async () => {
      fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({}));
      const adapter = makeAdapter();
      const { result, store } = renderHookWithStore(
        () => usePushRegistration(adapter),
        { projectId: "test-project" },
      );
      act(() => store.dispatch(setUser(makeAuthUser())));

      let registered: boolean | undefined;
      await act(async () => {
        registered = await result.current.register();
      });

      expect(registered).toBe(true);
      expect(adapter.requestPermission).toHaveBeenCalledTimes(1);
      expect(adapter.getDeviceIdentifier).toHaveBeenCalledWith({
        projectId: "test-project",
      });

      const postCall = fetchHandle.calls().find((c) => c.method === "POST");
      expect(postCall?.url).toContain("/test-project/push-notifications/devices");
    });

    it("returns false without calling the API when permission is denied", async () => {
      const adapter = makeAdapter({
        requestPermission: vi.fn().mockResolvedValue(false),
      });
      const { result, store } = renderHookWithStore(
        () => usePushRegistration(adapter),
        { projectId: "test-project" },
      );
      act(() => store.dispatch(setUser(makeAuthUser())));

      let registered: boolean | undefined;
      await act(async () => {
        registered = await result.current.register();
      });

      expect(registered).toBe(false);
      expect(adapter.getDeviceIdentifier).not.toHaveBeenCalled();
      expect(fetchHandle.calls()).toHaveLength(0);
    });

    it("returns false without calling the API when the adapter yields no identifier", async () => {
      const adapter = makeAdapter({
        getDeviceIdentifier: vi.fn().mockResolvedValue(null),
      });
      const { result, store } = renderHookWithStore(
        () => usePushRegistration(adapter),
        { projectId: "test-project" },
      );
      act(() => store.dispatch(setUser(makeAuthUser())));

      let registered: boolean | undefined;
      await act(async () => {
        registered = await result.current.register();
      });

      expect(registered).toBe(false);
      expect(fetchHandle.calls()).toHaveLength(0);
    });

    it("throws when there is no authenticated user", async () => {
      const adapter = makeAdapter();
      const { result } = renderHookWithStore(() => usePushRegistration(adapter), {
        projectId: "test-project",
      });

      await expect(result.current.register()).rejects.toThrow(
        "No project ID or authenticated user available",
      );
      expect(adapter.requestPermission).not.toHaveBeenCalled();
    });

    it("re-throws on a failed registration request", async () => {
      fetchHandle.fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "boom" }, 500),
      );
      const adapter = makeAdapter();
      const { result, store } = renderHookWithStore(
        () => usePushRegistration(adapter),
        { projectId: "test-project" },
      );
      act(() => store.dispatch(setUser(makeAuthUser())));

      await expect(result.current.register()).rejects.toBeTruthy();
    });
  });

  describe("unregister", () => {
    it("fetches the identifier and DELETEs the device", async () => {
      fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({}));
      const adapter = makeAdapter();
      const { result, store } = renderHookWithStore(
        () => usePushRegistration(adapter),
        { projectId: "test-project" },
      );
      act(() => store.dispatch(setUser(makeAuthUser())));

      await act(async () => {
        await result.current.unregister();
      });

      expect(adapter.requestPermission).not.toHaveBeenCalled();
      const deleteCall = fetchHandle.calls().find((c) => c.method === "DELETE");
      expect(deleteCall?.url).toContain("/test-project/push-notifications/devices");
    });

    it("is a no-op when the adapter yields no identifier", async () => {
      const adapter = makeAdapter({
        getDeviceIdentifier: vi.fn().mockResolvedValue(null),
      });
      const { result, store } = renderHookWithStore(
        () => usePushRegistration(adapter),
        { projectId: "test-project" },
      );
      act(() => store.dispatch(setUser(makeAuthUser())));

      await act(async () => {
        await result.current.unregister();
      });

      expect(fetchHandle.calls()).toHaveLength(0);
    });

    it("throws when there is no authenticated user", async () => {
      const adapter = makeAdapter();
      const { result } = renderHookWithStore(() => usePushRegistration(adapter), {
        projectId: "test-project",
      });

      await expect(result.current.unregister()).rejects.toThrow(
        "No project ID or authenticated user available",
      );
    });

    it("re-throws on a failed deregistration request", async () => {
      fetchHandle.fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "boom" }, 500),
      );
      const adapter = makeAdapter();
      const { result, store } = renderHookWithStore(
        () => usePushRegistration(adapter),
        { projectId: "test-project" },
      );
      act(() => store.dispatch(setUser(makeAuthUser())));

      await expect(result.current.unregister()).rejects.toBeTruthy();
    });
  });
});
