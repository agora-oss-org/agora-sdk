import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks, makeAuthUser } from "../../test-utils";
import useConfirmAccountDeletion from "./useConfirmAccountDeletion";
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

describe("useConfirmAccountDeletion", () => {
  it("deletes the account and switches to a remaining one when present", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(
      () => useConfirmAccountDeletion(),
      { accessToken: "access-1", refreshToken: "refresh-1" },
    );
    act(() => {
      store.dispatch(setAccountMap({ activeAccountId: "user-1", accounts: makeAccounts() }));
    });

    axiosPublic.mockResponse("post", {}); // confirm-account-deletion
    axiosPublic.mockResponse("post", {
      accessToken: "access-2",
      refreshToken: "refresh-2-rotated",
      user: makeAuthUser({ id: "user-2" }),
    }); // request-new-access-token

    await act(async () => {
      await result.current({ code: "  123456  " });
    });

    expect(store.getState().replyke.accounts.accounts["user-1"]).toBeUndefined();
    expect(store.getState().replyke.auth.accessToken).toBe("access-2");

    const calls = axiosPublic.calls("post");
    expect(calls[0].url).toBe("/test-project/auth/confirm-account-deletion");
    expect(calls[0].body).toEqual({ code: "123456" });
  });

  it("fully resets local state when no accounts remain", async () => {
    const { result, store, axiosPublic } = renderHookWithAxios(
      () => useConfirmAccountDeletion(),
      { accessToken: "access-1", refreshToken: "refresh-1" },
    );
    act(() => {
      store.dispatch(
        setAccountMap({ activeAccountId: "user-1", accounts: { "user-1": makeAccounts()["user-1"] } }),
      );
    });

    axiosPublic.mockResponse("post", {});

    await act(async () => {
      await result.current({ code: "123456" });
    });

    expect(store.getState().replyke.accounts.accounts).toEqual({});
    expect(store.getState().replyke.auth.accessToken).toBeNull();
  });

  it("rejects when the server rejects the confirmation code", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() => useConfirmAccountDeletion());

    axiosPublic.mockError("post", 400, { message: "Invalid or expired code" });

    await expect(result.current({ code: "wrong-code" })).rejects.toThrow();
  });

  it("throws before making a request when the code is blank", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() => useConfirmAccountDeletion());

    await expect(result.current({ code: "   " })).rejects.toThrow(
      "Confirmation code is required.",
    );
    expect(axiosPublic.calls("post")).toHaveLength(0);
  });

  it("throws before making a request when there is no project", async () => {
    const { result, axiosPublic } = renderHookWithAxios(
      () => useConfirmAccountDeletion(),
      { projectId: "" },
    );

    await expect(result.current({ code: "123456" })).rejects.toThrow(
      "No projectId available.",
    );
    expect(axiosPublic.calls("post")).toHaveLength(0);
  });
});
