import { describe, it, expect, afterEach, vi } from "vitest";

import { makeReplykeStore, mockAxiosPublic, resetAxiosMocks } from "../../test-utils";
import {
  signUpWithEmailAndPasswordThunk,
  signInWithEmailAndPasswordThunk,
  signOutThunk,
  requestNewAccessTokenThunk,
  changePasswordThunk,
  initializeAuthThunk,
} from "./authThunks";
import { setTokens, setUser } from "./authSlice";
import { setAccountMap } from "./accountsSlice";
import { selectUser as selectUserSliceUser } from "./userSlice";
import type { AuthUser } from "../../interfaces/models/User";
import {
  getAccessToken,
  hasTokenRefresher,
  refreshAccessToken,
  whenAuthSettled,
  armAuthLatch,
} from "../../config/runtime";

afterEach(() => {
  resetAxiosMocks();
  vi.unstubAllGlobals();
});

describe("signUpWithEmailAndPasswordThunk", () => {
  it("stores the returned tokens/user and syncs the user slice", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    const user = { id: "user-1" } as AuthUser;
    axios.mockResponse("post", { accessToken: "access-1", refreshToken: "refresh-1", user });

    const result = await store.dispatch(
      signUpWithEmailAndPasswordThunk({
        projectId: "project-1",
        email: "a@b.com",
        password: "secret",
      }),
    );

    expect(signUpWithEmailAndPasswordThunk.fulfilled.match(result)).toBe(true);
    const state = store.getState();
    expect(state.replyke.auth.accessToken).toBe("access-1");
    expect(state.replyke.auth.refreshToken).toBe("refresh-1");
    expect(state.replyke.auth.user).toEqual(user);
    expect(state.replyke.auth.isAuthenticating).toBe(false);
    expect(selectUserSliceUser(state)).toEqual(user);

    expect(axios.calls("post")[0].url).toBe("/project-1/auth/sign-up");
    expect(axios.calls("post")[0].body).toMatchObject({
      email: "a@b.com",
      emailRedirectTo: window.location.origin,
    });
  });

  it("appends emailRedirectTo to the FormData body when uploading an avatar", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    axios.mockResponse("post", {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      user: { id: "user-1" },
    });

    await store.dispatch(
      signUpWithEmailAndPasswordThunk({
        projectId: "project-1",
        email: "a@b.com",
        password: "secret",
        avatarFile: new Blob(["img"], { type: "image/png" }),
      }),
    );

    const body = axios.calls("post")[0].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("emailRedirectTo")).toBe(window.location.origin);
  });

  it("omits emailRedirectTo when no origin resolves (RN path)", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    axios.mockResponse("post", {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      user: { id: "user-1" },
    });
    vi.stubGlobal("window", undefined);

    await store.dispatch(
      signUpWithEmailAndPasswordThunk({
        projectId: "project-1",
        email: "a@b.com",
        password: "secret",
      }),
    );
    vi.unstubAllGlobals();

    expect(axios.calls("post")[0].body).not.toHaveProperty("emailRedirectTo");
  });
});

describe("signInWithEmailAndPasswordThunk", () => {
  it("stores tokens/user on success", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    const user = { id: "user-1" } as AuthUser;
    axios.mockResponse("post", { accessToken: "access-1", refreshToken: "refresh-1", user });

    const result = await store.dispatch(
      signInWithEmailAndPasswordThunk({
        projectId: "project-1",
        email: "a@b.com",
        password: "secret",
      }),
    );

    expect(signInWithEmailAndPasswordThunk.fulfilled.match(result)).toBe(true);
    expect(store.getState().replyke.auth.accessToken).toBe("access-1");
  });

  it("rejects with the error message and resets isAuthenticating on failure", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    axios.mockError("post", 401, { message: "Invalid credentials" });

    const result = await store.dispatch(
      signInWithEmailAndPasswordThunk({
        projectId: "project-1",
        email: "a@b.com",
        password: "wrong",
      }),
    );

    expect(signInWithEmailAndPasswordThunk.rejected.match(result)).toBe(true);
    const state = store.getState();
    expect(state.replyke.auth.accessToken).toBeNull();
    expect(state.replyke.auth.isAuthenticating).toBe(false);
  });
});

describe("signOutThunk", () => {
  it("throws a guard error when there is no refresh token", async () => {
    const store = makeReplykeStore();

    const result = await store.dispatch(signOutThunk({ projectId: "project-1" }));

    expect(signOutThunk.rejected.match(result)).toBe(true);
    if (signOutThunk.rejected.match(result)) {
      expect(result.error.message).toBe("No refresh token");
    }
  });

  it("resets auth state on a standard sign-out (no other accounts)", async () => {
    const store = makeReplykeStore();
    store.dispatch(setTokens({ accessToken: "access-1", refreshToken: "refresh-1" }));
    store.dispatch(setUser({ id: "user-1" } as AuthUser));
    const axios = mockAxiosPublic();
    axios.mockResponse("post", {});

    const result = await store.dispatch(signOutThunk({ projectId: "project-1" }));

    expect(signOutThunk.fulfilled.match(result)).toBe(true);
    const state = store.getState();
    expect(state.replyke.auth.accessToken).toBeNull();
    expect(state.replyke.auth.refreshToken).toBeNull();
    expect(state.replyke.auth.user).toBeNull();
    expect(axios.calls("post")[0].url).toBe("/project-1/auth/sign-out");
  });

  it("switches to the next account instead of a full reset when one remains", async () => {
    const store = makeReplykeStore();
    store.dispatch(setTokens({ accessToken: "access-1", refreshToken: "refresh-1" }));
    store.dispatch(
      setAccountMap({
        activeAccountId: "user-1",
        accounts: {
          "user-1": {
            refreshToken: "refresh-1",
            tokenExpiresAt: Date.now() + 100_000,
            user: { id: "user-1", name: "A", email: null, avatar: null },
          },
          "user-2": {
            refreshToken: "refresh-2",
            tokenExpiresAt: Date.now() + 100_000,
            user: { id: "user-2", name: "B", email: null, avatar: null },
          },
        },
      }),
    );
    const axios = mockAxiosPublic();
    // sign-out call, then the requestNewAccessToken call for the next account
    axios.mockResponse("post", {});
    axios.mockResponse("post", {
      accessToken: "access-2",
      refreshToken: "refresh-2-rotated",
      user: { id: "user-2" },
    });

    const result = await store.dispatch(signOutThunk({ projectId: "project-1" }));

    expect(signOutThunk.fulfilled.match(result)).toBe(true);
    const state = store.getState();
    expect(state.replyke.auth.accessToken).toBe("access-2");
    expect(state.replyke.auth.refreshToken).toBe("refresh-2-rotated");
    expect(state.replyke.auth.initialized).toBe(true);

    const urls = axios.calls("post").map((c) => c.url);
    expect(urls).toEqual([
      "/project-1/auth/sign-out",
      "/project-1/auth/request-new-access-token",
    ]);
  });
});

describe("requestNewAccessTokenThunk", () => {
  it("is a no-op when there is no refresh token", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();

    const result = await store.dispatch(requestNewAccessTokenThunk({ projectId: "project-1" }));

    expect(requestNewAccessTokenThunk.fulfilled.match(result)).toBe(true);
    expect(result.payload).toBeUndefined();
    expect(axios.calls("post")).toHaveLength(0);
  });

  it("rotates the access and refresh tokens on success", async () => {
    const store = makeReplykeStore();
    store.dispatch(setTokens({ accessToken: "stale", refreshToken: "refresh-1" }));
    const axios = mockAxiosPublic();
    const user = { id: "user-1" } as AuthUser;
    axios.mockResponse("post", { accessToken: "fresh", refreshToken: "refresh-2", user });

    const result = await store.dispatch(requestNewAccessTokenThunk({ projectId: "project-1" }));

    expect(requestNewAccessTokenThunk.fulfilled.match(result)).toBe(true);
    expect(result.payload).toBe("fresh");
    const state = store.getState();
    expect(state.replyke.auth.accessToken).toBe("fresh");
    expect(state.replyke.auth.refreshToken).toBe("refresh-2");
  });
});

describe("changePasswordThunk", () => {
  it("throws a guard error when no user is authenticated", async () => {
    const store = makeReplykeStore();

    const result = await store.dispatch(
      changePasswordThunk({ projectId: "project-1", password: "old", newPassword: "new" }),
    );

    expect(changePasswordThunk.rejected.match(result)).toBe(true);
    if (changePasswordThunk.rejected.match(result)) {
      expect(result.error.message).toBe("No user is authenticated");
    }
  });

  it("succeeds when a user is authenticated", async () => {
    const store = makeReplykeStore();
    store.dispatch(setUser({ id: "user-1" } as AuthUser));
    const axios = mockAxiosPublic();
    axios.mockResponse("post", {});

    const result = await store.dispatch(
      changePasswordThunk({ projectId: "project-1", password: "old", newPassword: "new" }),
    );

    expect(changePasswordThunk.fulfilled.match(result)).toBe(true);
    expect(store.getState().replyke.auth.isAuthenticating).toBe(false);
  });
});

describe("initializeAuthThunk", () => {
  it("verifies the signed token then refreshes, finishing with initialized=true", async () => {
    const store = makeReplykeStore();
    store.dispatch(setTokens({ accessToken: null, refreshToken: "refresh-1" }));
    const axios = mockAxiosPublic();
    const user = { id: "user-1" } as AuthUser;
    axios.mockResponse("post", { accessToken: "from-verify", refreshToken: "refresh-1", user });
    axios.mockResponse("post", { accessToken: "from-refresh", refreshToken: "refresh-2", user });

    await store.dispatch(initializeAuthThunk({ projectId: "project-1", signedToken: "jwt" }));

    const state = store.getState();
    expect(state.replyke.auth.initialized).toBe(true);
    expect(state.replyke.auth.accessToken).toBe("from-refresh");

    const urls = axios.calls("post").map((c) => c.url);
    expect(urls).toEqual([
      "/project-1/auth/verify-external-user",
      "/project-1/auth/request-new-access-token",
    ]);
  });

  it("skips verify-external-user and still refreshes when there is no signed token", async () => {
    const store = makeReplykeStore();
    store.dispatch(setTokens({ accessToken: null, refreshToken: "refresh-1" }));
    const axios = mockAxiosPublic();
    axios.mockResponse("post", { accessToken: "from-refresh", refreshToken: "refresh-2", user: null });

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    expect(store.getState().replyke.auth.initialized).toBe(true);
    const urls = axios.calls("post").map((c) => c.url);
    expect(urls).toEqual(["/project-1/auth/request-new-access-token"]);
  });
});

describe("initializeAuthThunk — transport wiring (divergence #8)", () => {
  it("registers the access-token getter against the live store", async () => {
    const store = makeReplykeStore();
    mockAxiosPublic();

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    expect(getAccessToken()).toBeNull();
    store.dispatch(setTokens({ accessToken: "access-9", refreshToken: "refresh-9" }));
    expect(getAccessToken()).toBe("access-9");
  });

  it("registers a refresher that resolves undefined when signed out", async () => {
    const store = makeReplykeStore();
    mockAxiosPublic();

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    expect(hasTokenRefresher()).toBe(true);
    await expect(refreshAccessToken()).resolves.toBeUndefined();
  });

  it("registers a refresher that exchanges the refresh token and updates the store", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    store.dispatch(setTokens({ accessToken: "stale", refreshToken: "refresh-1" }));
    axios.mockResponse("post", {
      accessToken: "fresh",
      refreshToken: "refresh-2",
      user: { id: "user-1" },
    });

    await expect(refreshAccessToken()).resolves.toBe("fresh");
    expect(store.getState().replyke.auth.accessToken).toBe("fresh");
    expect(axios.calls("post")[0].url).toBe("/project-1/auth/request-new-access-token");
  });

  it("releases the boot latch even when the boot refresh fails", async () => {
    armAuthLatch();
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    store.dispatch(setTokens({ accessToken: null, refreshToken: "refresh-1" }));
    axios.mockError("post", 500);

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    await expect(whenAuthSettled()).resolves.toBeUndefined();
  });
});
