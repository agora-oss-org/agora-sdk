// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — base URL injected at runtime (see config/runtime.ts)
// and module-level auth transport (divergence #8): the Agora server requires a JWT on all content
// routes, so both instances attach the current access token, park boot-time requests on the auth
// latch, and retry once through the shared single-flight refresh on 401.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.

import axios from "axios";
import {
  getApiBaseUrl,
  getAccessToken,
  whenAuthSettled,
  hasTokenRefresher,
  refreshAccessToken,
} from "./runtime";

// Base URL is read LAZILY per request (the consuming app sets it via <ReplykeProvider baseUrl>),
// so a request interceptor stamps `baseURL` on every call rather than baking it at module load.
const withRuntimeBaseUrl = (instance: ReturnType<typeof axios.create>) => {
  instance.interceptors.request.use((config) => {
    config.baseURL = getApiBaseUrl();
    return config;
  });
  return instance;
};

// /auth/ requests are exempt from the latch AND the 401-refresh, but DO still carry the token
// when one is available: the boot refresh itself flows through the public instance BEFORE the
// latch resolves (gating it would deadlock the SDK), a failed sign-in's 401 must never trigger a
// refresh, and authed auth routes (change-password, request/confirm-account-deletion) require
// `requireAuth` server-side, so they still need the bearer header. Known limitation: because the
// response-side guard below stays a blanket /auth/ match, those authed routes get the token but
// not refresh-and-retry on 401 — an expired token at call time surfaces to the caller as-is.
const isAuthPath = (url: string | undefined): boolean => (url ?? "").includes("/auth/");

/** Agora divergence #8 — token attach + boot latch + reactive 401 refresh, at module level so
 *  hooks on the public instance (and code outside useAxiosPrivate's lifecycle) are covered.
 *  Exported for tests. */
export const withAuthTransport = (instance: ReturnType<typeof axios.create>) => {
  instance.interceptors.request.use(async (config) => {
    if (!isAuthPath(config.url)) await whenAuthSettled();
    if (!config.headers["Authorization"]) {
      const token = getAccessToken();
      if (token) config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const prevRequest = error?.config;
      if (
        error?.response?.status === 401 &&
        prevRequest &&
        !prevRequest.sent &&
        !isAuthPath(prevRequest.url) &&
        // Transparent until initializeAuthThunk registers a refresher (boot, core-only, tests) —
        // useAxiosPrivate's hook-level handler still owns the retry in that window.
        hasTokenRefresher()
      ) {
        // `sent` is shared with useAxiosPrivate's handler: one refresh+retry per request, ever.
        prevRequest.sent = true;
        const newAccessToken = await refreshAccessToken();
        if (!newAccessToken) return Promise.reject(error);
        prevRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return instance(prevRequest);
      }
      return Promise.reject(error);
    },
  );

  return instance;
};

// withRuntimeBaseUrl FIRST so its handler stays request handlers[0] (asserted in tests) and the
// auth request interceptor (LIFO) runs before it; withAuthTransport's response handler then runs
// before useAxiosPrivate's (FIFO).
const axiosInstance = withAuthTransport(withRuntimeBaseUrl(axios.create()));

export const axiosPrivate = withAuthTransport(
  withRuntimeBaseUrl(axios.create({ headers: { "Content-Type": "application/json" } })),
);

export default axiosInstance;
