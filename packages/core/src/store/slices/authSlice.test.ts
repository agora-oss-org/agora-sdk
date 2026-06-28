import { describe, it, expect } from "vitest";

import reducer, {
  setTokens,
  clearTokens,
  setUser,
  setAuthenticating,
  setInitialized,
  setSignedToken,
  resetAuth,
  setRefreshToken,
  selectAccessToken,
  selectRefreshToken,
  selectUser,
  selectIsAuthenticating,
  selectInitialized,
  selectSignedToken,
  type AuthState,
} from "./authSlice";
import type { AuthUser } from "../../interfaces/models/User";

const initial: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticating: false,
  initialized: false,
  signedToken: null,
};

const user = { id: "user-1" } as AuthUser;

describe("authSlice", () => {
  it("setTokens sets the access token and leaves refreshToken untouched when omitted", () => {
    const s1 = reducer(initial, setTokens({ accessToken: "access-1" }));
    expect(s1.accessToken).toBe("access-1");
    expect(s1.refreshToken).toBeNull();

    const s2 = reducer(s1, setTokens({ accessToken: "access-2", refreshToken: "refresh-1" }));
    expect(s2.accessToken).toBe("access-2");
    expect(s2.refreshToken).toBe("refresh-1");
  });

  it("clearTokens nulls both tokens", () => {
    const seeded = reducer(initial, setTokens({ accessToken: "a", refreshToken: "r" }));
    const cleared = reducer(seeded, clearTokens());
    expect(cleared.accessToken).toBeNull();
    expect(cleared.refreshToken).toBeNull();
  });

  it("setUser stores the user", () => {
    const s = reducer(initial, setUser(user));
    expect(s.user).toEqual(user);
    expect(reducer(s, setUser(null)).user).toBeNull();
  });

  it("setAuthenticating toggles the loading flag", () => {
    expect(reducer(initial, setAuthenticating(true)).isAuthenticating).toBe(true);
  });

  it("setInitialized and setSignedToken set their respective fields", () => {
    expect(reducer(initial, setInitialized(true)).initialized).toBe(true);
    expect(reducer(initial, setSignedToken("jwt")).signedToken).toBe("jwt");
  });

  it("setRefreshToken sets only the refresh token", () => {
    const s = reducer(initial, setRefreshToken("refresh-only"));
    expect(s.refreshToken).toBe("refresh-only");
    expect(s.accessToken).toBeNull();
  });

  it("resetAuth clears tokens/user/isAuthenticating but preserves initialized", () => {
    let s = reducer(initial, setTokens({ accessToken: "a", refreshToken: "r" }));
    s = reducer(s, setUser(user));
    s = reducer(s, setAuthenticating(true));
    s = reducer(s, setInitialized(true));

    const reset = reducer(s, resetAuth());
    expect(reset.accessToken).toBeNull();
    expect(reset.refreshToken).toBeNull();
    expect(reset.user).toBeNull();
    expect(reset.isAuthenticating).toBe(false);
    expect(reset.initialized).toBe(true);
  });

  it("selectors read state via the namespaced replyke.auth slice", () => {
    const s: AuthState = {
      accessToken: "a",
      refreshToken: "r",
      user,
      isAuthenticating: true,
      initialized: true,
      signedToken: "jwt",
    };
    const state = { replyke: { auth: s } } as never;

    expect(selectAccessToken(state)).toBe("a");
    expect(selectRefreshToken(state)).toBe("r");
    expect(selectUser(state)).toEqual(user);
    expect(selectIsAuthenticating(state)).toBe(true);
    expect(selectInitialized(state)).toBe(true);
    expect(selectSignedToken(state)).toBe("jwt");
  });
});
