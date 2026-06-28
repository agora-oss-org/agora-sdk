import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios } from "../../test-utils";
import useAccounts from "./useAccounts";
import { setAccountMap } from "../../store/slices/accountsSlice";

describe("useAccounts", () => {
  it("returns an empty list and null active account when there are none", () => {
    const { result } = renderHookWithAxios(() => useAccounts());

    expect(result.current.accounts).toEqual([]);
    expect(result.current.activeAccount).toBeNull();
    expect(result.current.accountCount).toBe(0);
  });

  it("derives account summaries and the active account from the accounts map", () => {
    const { result, store } = renderHookWithAxios(() => useAccounts());

    act(() => {
      store.dispatch(
        setAccountMap({
          activeAccountId: "user-1",
          accounts: {
            "user-1": {
              refreshToken: "token-1",
              tokenExpiresAt: 0,
              user: { id: "user-1", name: "Alice", email: null, avatar: null },
            },
            "user-2": {
              refreshToken: "token-2",
              tokenExpiresAt: 0,
              user: { id: "user-2", name: "Bob", email: null, avatar: null },
            },
          },
        }),
      );
    });

    expect(result.current.accountCount).toBe(2);
    expect(result.current.accounts.map((a) => a.id)).toEqual(["user-1", "user-2"]);
    expect(result.current.activeAccount).toEqual({
      id: "user-1",
      name: "Alice",
      email: null,
      avatar: null,
    });
  });
});
