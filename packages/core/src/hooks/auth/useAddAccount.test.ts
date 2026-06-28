import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, makeAuthUser } from "../../test-utils";
import useAddAccount from "./useAddAccount";
import { setAccountMap, MAX_ACCOUNTS, type AccountEntry } from "../../store/slices/accountsSlice";
import { setUser as setUserInUserSlice } from "../../store/slices/userSlice";

function makeAccounts(count: number): Record<string, AccountEntry> {
  const accounts: Record<string, AccountEntry> = {};
  for (let i = 0; i < count; i++) {
    accounts[`user-${i}`] = {
      refreshToken: `token-${i}`,
      tokenExpiresAt: 0,
      user: { id: `user-${i}`, name: null, email: null, avatar: null },
    };
  }
  return accounts;
}

describe("useAddAccount", () => {
  it("clears auth/user state and the active account to surface the sign-in UI", () => {
    const user = makeAuthUser({ id: "user-1" });
    const { result, store } = renderHookWithAxios(() => useAddAccount(), {
      user,
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    act(() => {
      store.dispatch(setUserInUserSlice(user));
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts(1) }));
    });

    expect(result.current.canAddAccount).toBe(true);

    act(() => {
      result.current.addAccount();
    });

    expect(store.getState().replyke.auth.accessToken).toBeNull();
    expect(store.getState().replyke.auth.refreshToken).toBeNull();
    expect(store.getState().replyke.auth.user).toBeNull();
    expect(store.getState().replyke.user.user).toBeNull();
    expect(store.getState().replyke.accounts.activeAccountId).toBeNull();
    // Existing accounts in the map are left untouched.
    expect(Object.keys(store.getState().replyke.accounts.accounts)).toHaveLength(1);
  });

  it("reports canAddAccount as false and no-ops once MAX_ACCOUNTS is reached", () => {
    const { result, store } = renderHookWithAxios(() => useAddAccount());
    act(() => {
      store.dispatch(
        setAccountMap({ activeAccountId: "user-0", accounts: makeAccounts(MAX_ACCOUNTS) }),
      );
    });

    expect(result.current.canAddAccount).toBe(false);

    act(() => {
      result.current.addAccount();
    });

    // Nothing was reset since the cap was already reached.
    expect(store.getState().replyke.accounts.activeAccountId).toBe("user-0");
  });
});
