import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { waitFor } from "@testing-library/react";

import { setApiBaseUrl } from "../../config/runtime";
import {
  requestOAuthAuthorizationUrl,
  parseOAuthRedirectUrl,
  handleOAuthRedirect,
} from "./oauthCore";
import {
  makeReplykeStore,
  mockAxiosPublic,
  resetAxiosMocks,
  stubFetchMock,
  unstubFetchMock,
  jsonResponse,
} from "../../test-utils";

// Agora divergence (#1): OAuth helpers resolve the base URL at call time via getApiBaseUrl(),
// which is runtime-injected (no hardcoded brand host). Configure the fixture's expected base URL.
beforeEach(() => {
  setApiBaseUrl("https://api.replyke.io/v7");
});

afterEach(() => {
  setApiBaseUrl("http://localhost:4000/v7");
});

describe("parseOAuthRedirectUrl", () => {
  it("extracts tokens from the fragment and ignores the query", () => {
    const parsed = parseOAuthRedirectUrl(
      "https://app.example.com/callback?foo=bar#accessToken=a1&refreshToken=r1",
    );
    expect(parsed).toEqual({
      accessToken: "a1",
      refreshToken: "r1",
      error: null,
      errorDescription: null,
    });
  });

  it("extracts error/error_description from the query when there is no fragment", () => {
    const parsed = parseOAuthRedirectUrl(
      "https://app.example.com/callback?error=access_denied&error_description=User+cancelled",
    );
    expect(parsed).toEqual({
      accessToken: null,
      refreshToken: null,
      error: "access_denied",
      errorDescription: "User cancelled",
    });
  });

  it("returns all nulls for a bare URL", () => {
    expect(parseOAuthRedirectUrl("https://app.example.com/callback")).toEqual({
      accessToken: null,
      refreshToken: null,
      error: null,
      errorDescription: null,
    });
  });
});

describe("requestOAuthAuthorizationUrl", () => {
  afterEach(() => {
    unstubFetchMock();
  });

  it("POSTs to the authorize endpoint without an Authorization header", async () => {
    const { fetchMock } = stubFetchMock(async () =>
      jsonResponse({ authorizationUrl: "https://provider/auth" }),
    );

    const url = await requestOAuthAuthorizationUrl({
      projectId: "project-1",
      endpoint: "authorize",
      provider: "google",
      redirectAfterAuth: "https://app.example.com/done",
    });

    expect(url).toBe("https://provider/auth");
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://api.replyke.io/v7/project-1/oauth/authorize");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(init.body as string)).toEqual({
      provider: "google",
      redirectAfterAuth: "https://app.example.com/done",
    });
  });

  it("attaches a Bearer header for the link endpoint when an access token is provided", async () => {
    const { fetchMock } = stubFetchMock(async () =>
      jsonResponse({ authorizationUrl: "https://provider/link" }),
    );

    await requestOAuthAuthorizationUrl({
      projectId: "project-1",
      endpoint: "link",
      provider: "github",
      redirectAfterAuth: "https://app.example.com/done",
      accessToken: "token-a",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-a");
  });

  it("throws the server's error message on a non-ok response", async () => {
    stubFetchMock(async () => jsonResponse({ error: "Unsupported provider" }, 400));

    await expect(
      requestOAuthAuthorizationUrl({
        projectId: "project-1",
        endpoint: "authorize",
        provider: "unknown",
        redirectAfterAuth: "https://app.example.com/done",
      }),
    ).rejects.toThrow("Unsupported provider");
  });
});

describe("handleOAuthRedirect", () => {
  afterEach(() => {
    resetAxiosMocks();
  });

  it("dispatches tokens then fires the refresh thunk when projectId is provided", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    axios.mockResponse("post", { accessToken: "fresh", refreshToken: "rotated", user: null });

    const result = handleOAuthRedirect({
      dispatch: store.dispatch,
      projectId: "project-1",
      url: "https://app.example.com/callback?x=1#accessToken=a1&refreshToken=r1",
    });

    expect(result).toEqual({ success: true, error: null });
    expect(store.getState().replyke.auth.accessToken).toBe("a1");
    expect(store.getState().replyke.auth.initialized).toBe(true);

    await waitFor(() => expect(store.getState().replyke.auth.accessToken).toBe("fresh"));
    expect(axios.calls("post")[0].url).toBe("/project-1/auth/request-new-access-token");
  });

  it("dispatches tokens but skips the refresh thunk without a projectId", () => {
    const store = makeReplykeStore();
    const dispatchSpy = vi.spyOn(store, "dispatch");

    const result = handleOAuthRedirect({
      dispatch: store.dispatch,
      projectId: null,
      url: "https://app.example.com/callback#accessToken=a1&refreshToken=r1",
    });

    expect(result).toEqual({ success: true, error: null });
    expect(store.getState().replyke.auth.accessToken).toBe("a1");
    // setTokens + setInitialized only — no nested refresh thunk dispatch.
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
  });

  it("accepts pre-parsed params instead of a url string", () => {
    const store = makeReplykeStore();

    const result = handleOAuthRedirect({
      dispatch: store.dispatch,
      projectId: null,
      params: { accessToken: "a1", refreshToken: "r1", error: null, errorDescription: null },
    });

    expect(result).toEqual({ success: true, error: null });
    expect(store.getState().replyke.auth.refreshToken).toBe("r1");
  });

  it("returns the error without dispatching when the redirect carries an error", () => {
    const store = makeReplykeStore();
    const dispatchSpy = vi.spyOn(store, "dispatch");

    const result = handleOAuthRedirect({
      dispatch: store.dispatch,
      projectId: "project-1",
      url: "https://app.example.com/callback?error=access_denied&error_description=User+cancelled",
    });

    expect(result).toEqual({ success: false, error: "User cancelled" });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("returns success:false without dispatching when there are neither tokens nor an error", () => {
    const store = makeReplykeStore();
    const dispatchSpy = vi.spyOn(store, "dispatch");

    const result = handleOAuthRedirect({
      dispatch: store.dispatch,
      projectId: "project-1",
      url: "https://app.example.com/callback",
    });

    expect(result).toEqual({ success: false, error: null });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("returns success:false when neither url nor params are given", () => {
    const store = makeReplykeStore();
    const result = handleOAuthRedirect({ dispatch: store.dispatch, projectId: "project-1" });
    expect(result).toEqual({ success: false, error: null });
  });
});
