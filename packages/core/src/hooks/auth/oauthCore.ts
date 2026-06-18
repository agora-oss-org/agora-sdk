// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — OAuth requests resolve their API base URL from
// getApiBaseUrl() (the runtime value injected via <ReplykeProvider baseUrl>) rather than upstream's
// hardcoded production host (api.sublay.io). A self-hosted, Replyke-compatible Agora server handles
// its own OAuth, so the OAuth base URL must follow the injected value like every other request.
// This is the base-URL repoint (divergence #1) on the OAuth path.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import type { AppDispatch } from "../../store/types";
import { setTokens, setInitialized } from "../../store/slices/authSlice";
import { requestNewAccessTokenThunk } from "../../store/slices/authThunks";
import { getApiBaseUrl } from "../../config/runtime";

/**
 * Platform-agnostic OAuth helpers shared by the web (`@agora-sdk/react-js`) and
 * Expo (`@agora-sdk/expo`) `useOAuthSignIn` hooks.
 *
 * These helpers deliberately contain NO browser/DOM globals (`window`,
 * `document`, `localStorage`) and NO React Native globals, so the same code
 * path runs on every platform. Each platform owns only its own I/O: obtaining
 * the redirect URL (web reads `window.location`, Expo opens a web-browser auth
 * session) and any navigation/URL cleanup.
 */

/**
 * Server-call head: POST to `/{projectId}/oauth/{authorize|link}` and return the
 * provider `authorizationUrl`.
 *
 * - `authorize` is unauthenticated; `link` requires the caller's access token,
 *   passed via `accessToken` (sent as a Bearer header only when present).
 * - Throws an `Error` carrying the server's `error` body on a non-ok response.
 */
export async function requestOAuthAuthorizationUrl({
  projectId,
  endpoint,
  provider,
  redirectAfterAuth,
  accessToken,
  baseUrl = getApiBaseUrl(),
}: {
  projectId: string;
  endpoint: "authorize" | "link";
  provider: string;
  redirectAfterAuth: string;
  /** Required for `link`, omitted for `authorize`. */
  accessToken?: string | null;
  baseUrl?: string;
}): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl}/${projectId}/oauth/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ provider, redirectAfterAuth }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to initiate OAuth");
  }

  const data = await response.json();
  return data.authorizationUrl as string;
}

export interface OAuthRedirectParams {
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
}

/**
 * Tolerantly parse a redirect URL string into OAuth params.
 *
 * The Replyke OAuth callback carries tokens in the URL **fragment**
 * (`#accessToken=...&refreshToken=...`) and errors in the **query**
 * (`?error=...&error_description=...`). This splits the string by hand rather
 * than relying on `new URL().hash`, whose fragment handling is unreliable under
 * React Native's URL polyfill — exactly where the tokens live.
 */
export function parseOAuthRedirectUrl(url: string): OAuthRedirectParams {
  const hashIndex = url.indexOf("#");
  const fragment = hashIndex >= 0 ? url.substring(hashIndex + 1) : "";
  const beforeHash = hashIndex >= 0 ? url.substring(0, hashIndex) : url;

  const queryIndex = beforeHash.indexOf("?");
  const query = queryIndex >= 0 ? beforeHash.substring(queryIndex + 1) : "";

  const fragmentParams = new URLSearchParams(fragment);
  const queryParams = new URLSearchParams(query);

  return {
    accessToken: fragmentParams.get("accessToken"),
    refreshToken: fragmentParams.get("refreshToken"),
    error: queryParams.get("error"),
    errorDescription: queryParams.get("error_description"),
  };
}

export interface HandleOAuthRedirectResult {
  /** True when tokens were found and dispatched. */
  success: boolean;
  /** A human-readable error message when the redirect carried an `?error=`. */
  error: string | null;
}

/**
 * Token-handling tail: given a redirect URL **string**, extract the tokens /
 * error and, on success, perform the same Redux dispatches the web hook has
 * always done (`setTokens` → `setInitialized` → `requestNewAccessTokenThunk`).
 *
 * Pure of any I/O beyond dispatching: it does not read globals, navigate, or
 * clean the URL — the caller owns that. Accepts a URL string (or pre-parsed
 * `params`, e.g. from `expo-linking`) so any platform can feed it whatever it
 * obtained however it likes.
 *
 * Returns `{ success, error }` instead of throwing so callers can drive their
 * own loading/error UI state.
 */
export function handleOAuthRedirect({
  dispatch,
  projectId,
  url,
  params,
}: {
  dispatch: AppDispatch;
  projectId: string | null | undefined;
  url?: string;
  params?: OAuthRedirectParams;
}): HandleOAuthRedirectResult {
  const parsed = params ?? (url != null ? parseOAuthRedirectUrl(url) : null);

  if (!parsed) {
    return { success: false, error: null };
  }

  // Errors arrive in the query string. Surface them without dispatching.
  if (parsed.error) {
    return { success: false, error: parsed.errorDescription || parsed.error };
  }

  // Tokens arrive in the fragment. Only dispatch when both are present.
  if (parsed.accessToken && parsed.refreshToken) {
    dispatch(
      setTokens({
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      })
    );
    dispatch(setInitialized(true));

    // Fetch the user profile so `useAccountSync` can persist the account. The
    // thunk reads the just-set refresh token from Redux, calls the server, and
    // dispatches setUser + setUserInUserSlice on success.
    if (projectId) {
      dispatch(requestNewAccessTokenThunk({ projectId }));
    }

    return { success: true, error: null };
  }

  return { success: false, error: null };
}
