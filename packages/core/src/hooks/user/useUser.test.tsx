import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, waitFor } from "@testing-library/react";

import {
  renderHookWithStore,
  stubFetchMock,
  unstubFetchMock,
  jsonResponse,
  makeAuthUser,
  type FetchMockHandle,
} from "../../test-utils";
import { setUser as setAuthUser } from "../../store/slices/authSlice";
import { setUser as setSliceUser, setError } from "../../store/slices/userSlice";
import useUser from "./useUser";

let fetchHandle: FetchMockHandle;

beforeEach(() => {
  fetchHandle = stubFetchMock(async () => jsonResponse({}, 404));
});

afterEach(() => {
  cleanup();
  unstubFetchMock();
});

describe("useUser", () => {
  it("falls back to the authSlice user when the user slice is empty, then syncs it in", async () => {
    const authUser = makeAuthUser({ id: "user-1" });
    const { result, store } = renderHookWithStore(() => useUser(), {
      projectId: "test-project",
    });

    expect(result.current.user).toBeNull();

    act(() => store.dispatch(setAuthUser(authUser)));

    // Returned immediately via the `user || authUser` fallback...
    await waitFor(() => expect(result.current.user?.id).toBe("user-1"));
    // ...and also synced into the user slice itself.
    await waitFor(() => expect(store.getState().replyke.user.user?.id).toBe("user-1"));
  });

  it("does not overwrite an existing user-slice user with an auth-slice fallback", () => {
    const { result, store } = renderHookWithStore(() => useUser(), {
      projectId: "test-project",
    });
    act(() => store.dispatch(setSliceUser(makeAuthUser({ id: "user-1", name: "Slice User" }))));
    act(() => store.dispatch(setAuthUser(makeAuthUser({ id: "user-2", name: "Auth User" }))));

    expect(result.current.user?.id).toBe("user-1");
  });

  it("does not sync an auth user with no id", () => {
    const { result, store } = renderHookWithStore(() => useUser(), {
      projectId: "test-project",
    });
    act(() => store.dispatch(setAuthUser({ id: "" } as never)));

    expect(result.current.user?.id).toBeFalsy();
    expect(store.getState().replyke.user.user).toBeNull();
  });

  it("exposes loading/updating/error from the user slice, defaulting to falsy/null", () => {
    const { result } = renderHookWithStore(() => useUser(), { projectId: "test-project" });
    expect(result.current.loading).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe("updateUser", () => {
    it("throws without a current user", async () => {
      const { result } = renderHookWithStore(() => useUser(), { projectId: "test-project" });

      await expect(result.current.updateUser({ name: "New" })).rejects.toThrow(
        "No user available to update",
      );
    });

    it("throws without a projectId", async () => {
      const { result, store } = renderHookWithStore(() => useUser(), { projectId: "" });
      act(() => store.dispatch(setSliceUser(makeAuthUser({ id: "user-1" }))));

      await expect(result.current.updateUser({ name: "New" })).rejects.toThrow(
        "No projectId available",
      );
    });

    it("delegates to useUserActions.updateUser with the current user and projectId", async () => {
      fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({ id: "user-1", name: "New" }));
      const { result, store } = renderHookWithStore(() => useUser(), {
        projectId: "test-project",
      });
      act(() => store.dispatch(setSliceUser(makeAuthUser({ id: "user-1", name: "Old" }))));

      let returned: Awaited<ReturnType<typeof result.current.updateUser>> | undefined;
      await act(async () => {
        returned = await result.current.updateUser({ name: "New" });
      });

      expect(returned?.name).toBe("New");
      const call = fetchHandle.calls()[0];
      expect(call.url).toContain("/test-project/users/user-1");
    });
  });

  it("clearError clears the error field", () => {
    const { result, store } = renderHookWithStore(() => useUser(), { projectId: "test-project" });
    act(() => store.dispatch(setError("boom")));
    expect(result.current.error).toBe("boom");

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
