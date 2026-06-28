import { describe, it, expect, afterEach, vi } from "vitest";
import { waitFor } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeAuthUser } from "../../test-utils";
import useAccountSync from "./useAccountSync";
import { setTokens } from "../../store/slices/authSlice";
import { setUser } from "../../store/slices/userSlice";
import type { AccountMap } from "../../store/slices/accountsSlice";
import type { AccountStorage } from "../../interfaces/AccountStorage";

afterEach(() => {
  resetAxiosMocks();
});

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "none" })}.${encode(payload)}.fake-signature`;
}

function makeFakeStorage(initial: AccountMap | null = null): AccountStorage {
  let stored = initial;
  return {
    getAccountMap: vi.fn(async () => stored),
    setAccountMap: vi.fn(async (_projectId: string, map: AccountMap) => {
      stored = map;
    }),
    deleteAccountMap: vi.fn(async () => {
      stored = null;
    }),
  };
}

describe("useAccountSync", () => {
  it("loads the account map from storage on mount and sets the active account's refresh token", async () => {
    const jwt = makeJwt({ sub: "user-1", exp: 9999999999 });
    const storage = makeFakeStorage({
      activeAccountId: "user-1",
      accounts: {
        "user-1": {
          refreshToken: jwt,
          tokenExpiresAt: 9999999999000,
          user: { id: "user-1", name: "Alice", email: null, avatar: null },
        },
      },
    });

    const { store } = renderHookWithAxios(() => useAccountSync(storage, "test-project"));

    await waitFor(() => expect(store.getState().replyke.accounts.isReady).toBe(true));

    expect(store.getState().replyke.accounts.activeAccountId).toBe("user-1");
    expect(store.getState().replyke.accounts.accounts["user-1"].refreshToken).toBe(jwt);
    expect(store.getState().replyke.auth.refreshToken).toBe(jwt);
    expect(store.getState().replyke.accounts.accountManagerRegistered).toBe(true);
  });

  it("defaults to the first account when there is no active account id on load", async () => {
    const storage = makeFakeStorage({
      activeAccountId: null,
      accounts: {
        "user-1": {
          refreshToken: makeJwt({ sub: "user-1" }),
          tokenExpiresAt: 0,
          user: { id: "user-1", name: null, email: null, avatar: null },
        },
      },
    });

    const { store } = renderHookWithAxios(() => useAccountSync(storage, "test-project"));

    await waitFor(() =>
      expect(store.getState().replyke.accounts.activeAccountId).toBe("user-1"),
    );
  });

  it("becomes ready even when the storage read fails", async () => {
    const storage: AccountStorage = {
      getAccountMap: vi.fn().mockRejectedValue(new Error("disk error")),
      setAccountMap: vi.fn(),
      deleteAccountMap: vi.fn(),
    };

    const { store } = renderHookWithAxios(() => useAccountSync(storage, "test-project"));

    await waitFor(() => expect(store.getState().replyke.accounts.isReady).toBe(true));
    expect(store.getState().replyke.accounts.accounts).toEqual({});
  });

  it("upserts an account entry once a refresh token and matching user become available", async () => {
    const storage = makeFakeStorage(null);
    const { store } = renderHookWithAxios(() => useAccountSync(storage, "test-project"));

    await waitFor(() => expect(store.getState().replyke.accounts.isReady).toBe(true));

    const jwt = makeJwt({ sub: "user-1" });
    store.dispatch(setTokens({ accessToken: "access-1", refreshToken: jwt }));
    store.dispatch(setUser(makeAuthUser({ id: "user-1", name: "Alice" })));

    await waitFor(() =>
      expect(store.getState().replyke.accounts.accounts["user-1"]).toBeDefined(),
    );

    const entry = store.getState().replyke.accounts.accounts["user-1"];
    expect(entry.refreshToken).toBe(jwt);
    expect(entry.user).toMatchObject({ id: "user-1", name: "Alice" });
    expect(store.getState().replyke.accounts.activeAccountId).toBe("user-1");
  });

  it("does not upsert when the refresh token's sub disagrees with the current user", async () => {
    const storage = makeFakeStorage(null);
    const { store } = renderHookWithAxios(() => useAccountSync(storage, "test-project"));

    await waitFor(() => expect(store.getState().replyke.accounts.isReady).toBe(true));

    const jwtForSomeoneElse = makeJwt({ sub: "user-2" });
    store.dispatch(setTokens({ accessToken: "access-1", refreshToken: jwtForSomeoneElse }));
    store.dispatch(setUser(makeAuthUser({ id: "user-1" })));

    // Give the effect a tick to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().replyke.accounts.accounts).toEqual({});
  });

  it("persists the account map to storage after the initial load, but not during it", async () => {
    const jwt = makeJwt({ sub: "user-1" });
    const storage = makeFakeStorage({
      activeAccountId: "user-1",
      accounts: {
        "user-1": { refreshToken: jwt, tokenExpiresAt: 0, user: { id: "user-1", name: null, email: null, avatar: null } },
      },
    });

    const { store } = renderHookWithAxios(() => useAccountSync(storage, "test-project"));

    await waitFor(() => expect(store.getState().replyke.accounts.isReady).toBe(true));
    expect(storage.setAccountMap).not.toHaveBeenCalled();

    const jwt2 = makeJwt({ sub: "user-2" });
    store.dispatch(setTokens({ accessToken: "access-2", refreshToken: jwt2 }));
    store.dispatch(setUser(makeAuthUser({ id: "user-2", name: "Bob" })));

    await waitFor(() => expect(storage.setAccountMap).toHaveBeenCalled());
    const [, persistedMap] = (storage.setAccountMap as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(persistedMap.accounts["user-2"]).toBeDefined();
  });

  it("syncs the account map from a same-project 'storage' event fired by another tab", async () => {
    const storage = makeFakeStorage(null);
    const { store } = renderHookWithAxios(() => useAccountSync(storage, "test-project"));

    await waitFor(() => expect(store.getState().replyke.accounts.isReady).toBe(true));

    const jwt = makeJwt({ sub: "user-9" });
    const incomingMap: AccountMap = {
      activeAccountId: "user-9",
      accounts: {
        "user-9": { refreshToken: jwt, tokenExpiresAt: 0, user: { id: "user-9", name: "Remote", email: null, avatar: null } },
      },
    };

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "replyke-accounts:test-project",
        newValue: JSON.stringify(incomingMap),
      }),
    );

    await waitFor(() =>
      expect(store.getState().replyke.accounts.activeAccountId).toBe("user-9"),
    );
    expect(store.getState().replyke.auth.refreshToken).toBe(jwt);
  });

  it("ignores a 'storage' event for a different project's key", async () => {
    const storage = makeFakeStorage(null);
    const { store } = renderHookWithAxios(() => useAccountSync(storage, "test-project"));

    await waitFor(() => expect(store.getState().replyke.accounts.isReady).toBe(true));

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "replyke-accounts:other-project",
        newValue: JSON.stringify({ activeAccountId: "user-9", accounts: {} }),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().replyke.accounts.activeAccountId).toBeNull();
  });
});
