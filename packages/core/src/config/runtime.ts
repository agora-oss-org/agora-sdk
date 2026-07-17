// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — runtime-injectable API base URL, the
// email-link redirect origin sent with native-auth email requests, and the auth
// transport registry (token getter / single-flight refresh / boot latch — divergence #8).
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
//
// Single source of truth for the API base URL, read LAZILY (per request) so the consuming app can
// set it explicitly via <ReplykeProvider baseUrl={...}> before any request fires. The SDK no longer
// sniffs env vars — each platform (Vite/CRA/RN/Node) parses its own env and passes the value in.

import { getEnvVar } from "../utils/env";

const DEFAULT_API_BASE_URL = "http://localhost:4000/v7";

let apiBaseUrl = DEFAULT_API_BASE_URL;

/** Set the API base URL. Called by ReplykeProvider from its `baseUrl` prop. No-op for empty values. */
export function setApiBaseUrl(url: string | null | undefined): void {
  if (url) apiBaseUrl = url;
}

/** Current API base URL (e.g. https://host/v7). Read lazily by axios/RTK-Query/fetch consumers. */
export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

/** socket.io origin derived from the base URL (strips the /v7 path). */
export function getSocketUrl(): string {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "http://localhost:4000";
  }
}

/** Origin sent as `emailRedirectTo` with sign-up / request-password-reset /
 *  send-verification-email requests, so the server's emailed links return the user to the
 *  front-end that initiated them (multi-front-end deployments). Resolution: the
 *  AGORA_EMAIL_REDIRECT_TO env var (VITE_-/REACT_APP_-prefixed, via getEnvVar) →
 *  window.location.origin → undefined — callers must then OMIT the field so the server
 *  falls back to its own AUTH_EMAIL_LINK_BASE default (never send it empty). */
export function getEmailRedirectTo(): string | undefined {
  const fromEnv = getEnvVar("AGORA_EMAIL_REDIRECT_TO");
  if (fromEnv) return fromEnv;
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    window.location.origin !== "null" // opaque origin (sandboxed iframe / file://)
  ) {
    return window.location.origin;
  }
  return undefined;
}

// ── Auth transport registry (divergence #8) ──────────────────────────────────
// The Agora server requires a JWT on all content routes (no public reads). The transport
// layer (config/axios.ts, store/api/baseApi.ts) needs the current access token and a way
// to refresh it, but importing the store from here would be circular
// (store → slices → config/axios → runtime), so initializeAuthThunk registers callbacks.

let accessTokenGetter: (() => string | null) | null = null;

/** Register how the transport layer reads the current access token.
 *  Registered by initializeAuthThunk with the live store's getState. */
export function registerAccessTokenGetter(fn: () => string | null): void {
  accessTokenGetter = fn;
}

/** Current access token, or null when signed out / nothing registered yet. */
export function getAccessToken(): string | null {
  return accessTokenGetter ? accessTokenGetter() : null;
}

let tokenRefresher: (() => Promise<string | undefined>) | null = null;

/** Register how the transport layer refreshes the access token. Registered by
 *  initializeAuthThunk (the one place with projectId + dispatch in scope before any
 *  content request can fire). Must resolve undefined when refresh is impossible. */
export function registerTokenRefresher(fn: () => Promise<string | undefined>): void {
  tokenRefresher = fn;
}

export function hasTokenRefresher(): boolean {
  return tokenRefresher !== null;
}

// Single-flight: every 401 handler (the module interceptors in config/axios.ts,
// useAxiosPrivate's hook-level handler, and baseApi's retry) shares ONE in-flight
// refresh, so concurrent 401s can never race concurrent refresh-token rotations
// (the server's reuse detection would revoke the session).
let inflightRefresh: Promise<string | undefined> | null = null;

/** Run one shared token refresh. Concurrent callers get the same promise. Resolves
 *  undefined — never rejects — when no refresher is available or the refresh fails. */
export function refreshAccessToken(
  refresher?: () => Promise<string | undefined>,
): Promise<string | undefined> {
  if (!inflightRefresh) {
    const fn = refresher ?? tokenRefresher;
    if (!fn) return Promise.resolve(undefined);
    inflightRefresh = fn()
      .catch(() => undefined)
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

// ── Auth-settled boot latch (divergence #8) ──────────────────────────────────
// Content requests fired during boot (hooks mount and fetch before initializeAuthThunk
// has exchanged the stored refresh token) park here until auth init settles. Default is
// OPEN so core-only usage and tests that never mount a provider are unaffected; the
// providers arm it during render (parents render before children, so this beats any
// child hook's first request effect), and initializeAuthThunk releases it in `finally`.

let authLatch: { promise: Promise<void>; resolve: () => void } | null = null;
let authLatchUsed = false;

/** Arm the boot latch (one-shot per session). Called by the providers during render. */
export function armAuthLatch(): void {
  if (authLatchUsed) return;
  authLatchUsed = true;
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  authLatch = { promise, resolve };
}

/** Release the boot latch (success or failure). Called from initializeAuthThunk's finally. */
export function markAuthSettled(): void {
  authLatch?.resolve();
  authLatch = null;
}

/** Resolves when boot auth has settled — immediately if the latch was never armed. */
export function whenAuthSettled(): Promise<void> {
  return authLatch ? authLatch.promise : Promise.resolve();
}

/** Test-only: clear registered callbacks, any in-flight refresh, and the latch. */
export function __resetAuthTransportForTests(): void {
  accessTokenGetter = null;
  tokenRefresher = null;
  inflightRefresh = null;
  authLatch?.resolve();
  authLatch = null;
  authLatchUsed = false;
}
