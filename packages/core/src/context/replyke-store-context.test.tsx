import { describe, it, expect, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { ReplykeStoreProvider } from "./replyke-store-context";
import { replykeStore } from "../store";
import { useReplykeSelector } from "../store/hooks";
import { selectInitialized, setInitialized, resetAuth } from "../store/slices/authSlice";
import {
  registerAccountManager,
  setAccountsReady,
  clearAllAccounts,
} from "../store/slices/accountsSlice";

// ReplykeStoreProvider mounts the real `replykeStore` singleton (not a
// per-test store), so leftover state from one test is visible to the next —
// reset every slice this component touches.
afterEach(() => {
  act(() => {
    replykeStore.dispatch(resetAuth());
    replykeStore.dispatch(setInitialized(false));
    replykeStore.dispatch(clearAllAccounts());
    replykeStore.dispatch(setAccountsReady(false));
  });
});

describe("ReplykeStoreProvider", () => {
  it("initializes auth immediately when no AccountManager registers", async () => {
    const { result } = renderHook(() => useReplykeSelector(selectInitialized), {
      wrapper: ({ children }) => (
        <ReplykeStoreProvider projectId="test-project">{children}</ReplykeStoreProvider>
      ),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("waits for the AccountManager to report ready before initializing auth", async () => {
    act(() => {
      replykeStore.dispatch(registerAccountManager());
    });

    const { result } = renderHook(() => useReplykeSelector(selectInitialized), {
      wrapper: ({ children }) => (
        <ReplykeStoreProvider projectId="test-project">{children}</ReplykeStoreProvider>
      ),
    });

    // Flush the provider's one-microtask wait for AccountManager
    // registration. Auth must still be blocked: a manager registered, but it
    // hasn't signaled `accountsReady` yet.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toBe(false);

    act(() => {
      replykeStore.dispatch(setAccountsReady(true));
    });

    await waitFor(() => expect(result.current).toBe(true));
  });
});
