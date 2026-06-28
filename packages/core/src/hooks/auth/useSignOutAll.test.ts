import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useSignOutAll from "./useSignOutAll";
import { setAccountMap } from "../../store/slices/accountsSlice";
import type { AccountEntry } from "../../store/slices/accountsSlice";

afterEach(() => {
  resetAxiosMocks();
});

function makeAccounts(): Record<string, AccountEntry> {
  return {
    "user-1": { refreshToken: "refresh-1", tokenExpiresAt: 0, user: { id: "user-1", name: null, email: null, avatar: null } },
    "user-2": { refreshToken: "refresh-2", tokenExpiresAt: 0, user: { id: "user-2", name: null, email: null, avatar: null } },
  };
}

describe("useSignOutAll", () => {
  it("signs out every account on the server and clears all local state", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(() => useSignOutAll(), {
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    axiosPublic.mockResponse("post", {});
    axiosPublic.mockResponse("post", {});

    await act(async () => {
      await result.current.signOutAll();
    });

    expect(store.getState().replyke.accounts.accounts).toEqual({});
    expect(store.getState().replyke.accounts.activeAccountId).toBeNull();
    expect(store.getState().replyke.auth.accessToken).toBeNull();
    expect(store.getState().replyke.auth.refreshToken).toBeNull();

    const calls = axiosPublic.calls("post");
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.url)).toEqual([
      "/test-project/auth/sign-out",
      "/test-project/auth/sign-out",
    ]);
  });

  it("still clears local state when a per-account server sign-out fails (best-effort)", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(() => useSignOutAll());
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    axiosPublic.mockError("post", 500, { message: "Internal error" });
    axiosPublic.mockResponse("post", {});

    await act(async () => {
      await result.current.signOutAll();
    });

    expect(store.getState().replyke.accounts.accounts).toEqual({});
  });

  it("throws before doing anything when there is no project", async () => {
    const { result } = renderHookWithAxios(() => useSignOutAll(), { projectId: "" });

    await expect(result.current.signOutAll()).rejects.toThrow(
      "No projectId available.",
    );
  });
});
