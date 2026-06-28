import { describe, it, expect, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeAuthUser } from "../../test-utils";
import useRemoveAccount from "./useRemoveAccount";
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

describe("useRemoveAccount", () => {
  it("removes a non-active account without touching the current session", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(() => useRemoveAccount());
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    axiosPublic.mockResponse("post", {});

    await act(async () => {
      await result.current.removeAccount({ userId: "user-2" });
    });

    expect(store.getState().replyke.accounts.accounts["user-2"]).toBeUndefined();
    expect(store.getState().replyke.accounts.activeAccountId).toBe("user-1");

    const [call] = axiosPublic.calls("post");
    expect(call.url).toBe("/test-project/auth/sign-out");
    expect(call.body).toEqual({ refreshToken: "refresh-2" });
  });

  it("removing the active account switches to a remaining one and refreshes its token", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(() => useRemoveAccount());
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    axiosPublic.mockResponse("post", {}); // best-effort sign-out
    axiosPublic.mockResponse("post", {
      accessToken: "access-2",
      refreshToken: "refresh-2-rotated",
      user: makeAuthUser({ id: "user-2" }),
    }); // request-new-access-token for the next account

    await act(async () => {
      await result.current.removeAccount({ userId: "user-1" });
    });

    expect(store.getState().replyke.accounts.accounts["user-1"]).toBeUndefined();
    expect(store.getState().replyke.auth.accessToken).toBe("access-2");
    expect(store.getState().replyke.auth.refreshToken).toBe("refresh-2-rotated");

    const calls = axiosPublic.calls("post");
    expect(calls[0].url).toBe("/test-project/auth/sign-out");
    expect(calls[1].url).toBe("/test-project/auth/request-new-access-token");
  });

  it("removing the last remaining (active) account fully resets local auth state", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(() => useRemoveAccount());
    act(() => {
      store.dispatch(
        setAccountMap({ activeAccountId: "user-1", accounts: { "user-1": makeAccounts()["user-1"] } }),
      );
    });

    axiosPublic.mockResponse("post", {});

    await act(async () => {
      await result.current.removeAccount({ userId: "user-1" });
    });

    expect(store.getState().replyke.accounts.accounts).toEqual({});
    expect(store.getState().replyke.auth.accessToken).toBeNull();
    expect(store.getState().replyke.auth.refreshToken).toBeNull();
  });

  it("still removes the account locally when the best-effort server sign-out fails", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(() => useRemoveAccount());
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    axiosPublic.mockError("post", 500, { message: "Internal error" });

    await act(async () => {
      await result.current.removeAccount({ userId: "user-2" });
    });

    expect(result.current.error).toBeNull();
    expect(store.getState().replyke.accounts.accounts["user-2"]).toBeUndefined();
  });

  it("throws when the account is not found", async () => {
    const { result, store } = renderHookWithAxios(() => useRemoveAccount());
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    await expect(result.current.removeAccount({ userId: "user-missing" })).rejects.toThrow(
      "Account user-missing not found",
    );
  });

  it("throws before doing anything when there is no project", async () => {
    const { result } = renderHookWithAxios(() => useRemoveAccount(), { projectId: "" });

    await expect(result.current.removeAccount({ userId: "user-1" })).rejects.toThrow(
      "No projectId available",
    );
  });
});
