// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — runtime-injectable API base URL and the
// email-link redirect origin sent with native-auth email requests.
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
