import { describe, it, expect } from "vitest";

import accountsReducer, {
  setAccountMap,
  upsertAccount,
  removeAccount,
  setActiveAccount,
  clearAllAccounts,
  setAccountsReady,
  registerAccountManager,
  MAX_ACCOUNTS,
  type AccountsState,
  type AccountEntry,
} from "./accountsSlice";

function makeEntry(overrides: Partial<AccountEntry> = {}): AccountEntry {
  return {
    refreshToken: "refresh-token",
    tokenExpiresAt: 0,
    user: { id: "user-1", name: "User One", email: null, avatar: null },
    ...overrides,
  };
}

function initialState(overrides: Partial<AccountsState> = {}): AccountsState {
  return {
    accounts: {},
    activeAccountId: null,
    isReady: false,
    accountManagerRegistered: false,
    ...overrides,
  };
}

describe("accountsSlice", () => {
  it("setAccountMap replaces both accounts and activeAccountId", () => {
    const state = accountsReducer(
      initialState(),
      setAccountMap({
        activeAccountId: "user-1",
        accounts: { "user-1": makeEntry() },
      }),
    );

    expect(state.activeAccountId).toBe("user-1");
    expect(state.accounts["user-1"]).toEqual(makeEntry());
  });

  it("upsertAccount adds a new account entry", () => {
    const state = accountsReducer(
      initialState(),
      upsertAccount({ userId: "user-1", entry: makeEntry() }),
    );

    expect(state.accounts["user-1"]).toEqual(makeEntry());
  });

  it("upsertAccount overwrites an existing entry for the same user", () => {
    const start = initialState({ accounts: { "user-1": makeEntry() } });
    const updated = makeEntry({ refreshToken: "new-token" });

    const state = accountsReducer(
      start,
      upsertAccount({ userId: "user-1", entry: updated }),
    );

    expect(state.accounts["user-1"]).toEqual(updated);
  });

  it("upsertAccount silently ignores a new account once MAX_ACCOUNTS is reached", () => {
    const accounts: AccountsState["accounts"] = {};
    for (let i = 0; i < MAX_ACCOUNTS; i++) {
      accounts[`user-${i}`] = makeEntry({ user: { id: `user-${i}`, name: null, email: null, avatar: null } });
    }
    const start = initialState({ accounts });

    const state = accountsReducer(
      start,
      upsertAccount({ userId: "user-overflow", entry: makeEntry() }),
    );

    expect(Object.keys(state.accounts)).toHaveLength(MAX_ACCOUNTS);
    expect(state.accounts["user-overflow"]).toBeUndefined();
  });

  it("removeAccount removes the entry and reassigns activeAccountId when it was active", () => {
    const start = initialState({
      accounts: { "user-1": makeEntry(), "user-2": makeEntry() },
      activeAccountId: "user-1",
    });

    const state = accountsReducer(start, removeAccount("user-1"));

    expect(state.accounts["user-1"]).toBeUndefined();
    expect(state.activeAccountId).toBe("user-2");
  });

  it("removeAccount sets activeAccountId to null when no accounts remain", () => {
    const start = initialState({
      accounts: { "user-1": makeEntry() },
      activeAccountId: "user-1",
    });

    const state = accountsReducer(start, removeAccount("user-1"));

    expect(state.activeAccountId).toBeNull();
  });

  it("removeAccount leaves activeAccountId untouched when removing a non-active account", () => {
    const start = initialState({
      accounts: { "user-1": makeEntry(), "user-2": makeEntry() },
      activeAccountId: "user-1",
    });

    const state = accountsReducer(start, removeAccount("user-2"));

    expect(state.activeAccountId).toBe("user-1");
  });

  it("setActiveAccount sets the active account id directly", () => {
    const state = accountsReducer(initialState(), setActiveAccount("user-1"));
    expect(state.activeAccountId).toBe("user-1");
  });

  it("clearAllAccounts resets accounts and activeAccountId", () => {
    const start = initialState({
      accounts: { "user-1": makeEntry() },
      activeAccountId: "user-1",
    });

    const state = accountsReducer(start, clearAllAccounts());

    expect(state.accounts).toEqual({});
    expect(state.activeAccountId).toBeNull();
  });

  it("setAccountsReady toggles isReady", () => {
    const state = accountsReducer(initialState(), setAccountsReady(true));
    expect(state.isReady).toBe(true);
  });

  it("registerAccountManager flags accountManagerRegistered", () => {
    const state = accountsReducer(initialState(), registerAccountManager());
    expect(state.accountManagerRegistered).toBe(true);
  });
});
