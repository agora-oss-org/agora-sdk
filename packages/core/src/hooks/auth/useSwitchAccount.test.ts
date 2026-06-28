import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeAuthUser } from "../../test-utils";
import useSwitchAccount from "./useSwitchAccount";
import { setAccountMap } from "../../store/slices/accountsSlice";
import type { AccountEntry } from "../../store/slices/accountsSlice";

afterEach(() => {
  resetAxiosMocks();
});

function makeAccounts(): Record<string, AccountEntry> {
  return {
    "user-1": {
      refreshToken: "refresh-1",
      tokenExpiresAt: 0,
      user: { id: "user-1", name: "Alice", email: null, avatar: null },
    },
    "user-2": {
      refreshToken: "refresh-2",
      tokenExpiresAt: 0,
      user: { id: "user-2", name: "Bob", email: null, avatar: null },
    },
  };
}

describe("useSwitchAccount", () => {
  it("switches to another account and requests a fresh access token for it", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(
      () => useSwitchAccount(),
      { refreshToken: "refresh-1" },
    );

    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    const newUser = makeAuthUser({ id: "user-2", name: "Bob" });
    axiosPublic.mockResponse("post", {
      accessToken: "access-2",
      refreshToken: "refresh-2-rotated",
      user: newUser,
    });

    await act(async () => {
      await result.current.switchAccount({ userId: "user-2" });
    });

    expect(store.getState().replyke.accounts.activeAccountId).toBe("user-2");
    expect(store.getState().replyke.auth.accessToken).toBe("access-2");
    expect(store.getState().replyke.auth.refreshToken).toBe("refresh-2-rotated");
    expect(result.current.isSwitching).toBe(false);
    expect(result.current.error).toBeNull();

    const [call] = axiosPublic.calls("post");
    expect(call.url).toBe("/test-project/auth/request-new-access-token");
    expect(call.body).toEqual({ refreshToken: "refresh-2" });
  });

  it("is a no-op when switching to the already-active account", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(() => useSwitchAccount());
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    await act(async () => {
      await result.current.switchAccount({ userId: "user-1" });
    });

    expect(axiosPublic.calls("post")).toHaveLength(0);
  });

  it("throws when the target account is not in the map", async () => {
    const { result, store } = renderHookWithAxios(() => useSwitchAccount());
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    await expect(
      result.current.switchAccount({ userId: "user-missing" }),
    ).rejects.toThrow("Account user-missing not found");
  });

  it("does not throw when requesting the new access token fails (swallowed inside the thunk)", async () => {
    // requestNewAccessTokenThunk catches its own errors and resolves with a
    // rejected action rather than throwing, so the awaiting `dispatch(...)`
    // call here never rejects — switchAccount completes as if it succeeded,
    // just without a fresh access token. No `.rejected.match` check exists to
    // surface that failure as this hook's own `error` state.
    const { result, store, axiosPublic } = renderHookWithAxios(() => useSwitchAccount());
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    axiosPublic.mockError("post", 500, { message: "Internal error" });

    await act(async () => {
      await result.current.switchAccount({ userId: "user-2" });
    });

    await waitFor(() => expect(result.current.isSwitching).toBe(false));
    expect(result.current.error).toBeNull();
    expect(store.getState().replyke.accounts.activeAccountId).toBe("user-2");
  });

  it("throws before doing anything when there is no project", async () => {
    const { result } = renderHookWithAxios(() => useSwitchAccount(), { projectId: "" });

    await expect(result.current.switchAccount({ userId: "user-2" })).rejects.toThrow(
      "No projectId available",
    );
  });
});
