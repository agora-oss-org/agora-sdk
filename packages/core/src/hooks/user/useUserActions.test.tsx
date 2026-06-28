import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup } from "@testing-library/react";

import {
  renderHookWithStore,
  stubFetchMock,
  unstubFetchMock,
  jsonResponse,
  type FetchMockHandle,
} from "../../test-utils";
import { useUserActions } from "./useUserActions";
import { selectUser, selectUserUpdating, selectUserError, setError } from "../../store/slices/userSlice";
import type { AuthUser } from "../../interfaces/models/User";

let fetchHandle: FetchMockHandle;

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser =>
  ({ id: "user-1", name: "Old", username: "olduser", ...overrides }) as AuthUser;

beforeEach(() => {
  fetchHandle = stubFetchMock(async () => jsonResponse({}, 404));
});

afterEach(() => {
  cleanup();
  unstubFetchMock();
});

describe("useUserActions", () => {
  describe("setUser", () => {
    it("stores a valid user and clears any existing error", () => {
      const { result, store } = renderHookWithStore(() => useUserActions());
      act(() => result.current.setUser(makeUser()));
      expect(selectUser(store.getState())?.id).toBe("user-1");
    });

    it("ignores a user object missing an id, with a warning", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { result, store } = renderHookWithStore(() => useUserActions());

      act(() => result.current.setUser({ name: "No Id" } as never));

      expect(selectUser(store.getState())).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("setUser(null) is valid and clears the user", () => {
      const { result, store } = renderHookWithStore(() => useUserActions());
      act(() => result.current.setUser(makeUser()));
      act(() => result.current.setUser(null));
      expect(selectUser(store.getState())).toBeNull();
    });
  });

  it("clearUser clears the user and error", () => {
    const { result, store } = renderHookWithStore(() => useUserActions());
    act(() => result.current.setUser(makeUser()));
    act(() => result.current.clearUser());
    expect(selectUser(store.getState())).toBeNull();
    expect(selectUserError(store.getState())).toBeNull();
  });

  describe("updateUser", () => {
    it("throws without a projectId or userId", async () => {
      const { result } = renderHookWithStore(() => useUserActions());

      await expect(
        result.current.updateUser({ projectId: "", userId: "user-1", update: {} }),
      ).rejects.toThrow("Project ID and User ID are required");
    });

    it("applies an optimistic update, then replaces it with the server response", async () => {
      fetchHandle.fetchMock.mockResolvedValueOnce(
        jsonResponse({ id: "user-1", name: "Server Name" }),
      );
      const { result, store } = renderHookWithStore(() => useUserActions());
      const currentUser = makeUser();

      let returned: AuthUser | undefined;
      await act(async () => {
        returned = await result.current.updateUser({
          projectId: "test-project",
          userId: "user-1",
          update: { name: "New Name" },
          currentUser,
        });
      });

      expect(returned?.name).toBe("Server Name");
      expect(selectUser(store.getState())?.name).toBe("Server Name");
      expect(selectUserUpdating(store.getState())).toBe(false);
    });

    it("does not apply an optimistic update for file-based avatar uploads", async () => {
      fetchHandle.fetchMock.mockImplementationOnce(async () => {
        // Mid-flight: the optimistic patch must not have touched `avatar`.
        return jsonResponse({ id: "user-1", avatar: "https://cdn.example/avatar.png" });
      });
      const { result, store } = renderHookWithStore(() => useUserActions());
      const currentUser = makeUser({ avatar: null });

      await act(async () => {
        await result.current.updateUser({
          projectId: "test-project",
          userId: "user-1",
          update: { avatar: { file: new File(["x"], "a.png"), options: {} as never } },
          currentUser,
        });
      });

      expect(selectUser(store.getState())?.avatar).toBe("https://cdn.example/avatar.png");
    });

    it("reverts to the original user and records the error message on failure", async () => {
      fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({ message: "boom" }, 500));
      const { result, store } = renderHookWithStore(() => useUserActions());
      const currentUser = makeUser();

      await act(async () => {
        await expect(
          result.current.updateUser({
            projectId: "test-project",
            userId: "user-1",
            update: { name: "New Name" },
            currentUser,
          }),
        ).rejects.toBeTruthy();
      });

      expect(selectUser(store.getState())?.name).toBe("Old"); // reverted
      expect(selectUserUpdating(store.getState())).toBe(false);
      expect(selectUserError(store.getState())).toBeTruthy();
    });
  });

  it("clearError clears the error field", () => {
    const { result, store } = renderHookWithStore(() => useUserActions());
    act(() => store.dispatch(setError("boom")));
    expect(selectUserError(store.getState())).toBe("boom");

    act(() => result.current.clearError());
    expect(selectUserError(store.getState())).toBeNull();
  });
});
