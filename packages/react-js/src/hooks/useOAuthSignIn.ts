// Modified from the original @replyke/react-js source.
// Modifications Copyright 2026 Jenova Marie — repointed the hardcoded Replyke OAuth
// base URL to a self-hosted, Replyke-compatible Agora backend.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.

import { useCallback, useState } from "react";
import {
  useProject,
  useReplykeDispatch,
  useReplykeSelector,
  setTokens,
  setInitialized,
  selectAccessToken,
  requestNewAccessTokenThunk,
  getApiBaseUrl,
} from "@agora-sdk/core";

// Base URL is injected at runtime (<ReplykeProvider baseUrl>), so read it at request time.

export interface UseOAuthSignInReturn {
  /** Initiate OAuth sign-in / sign-up (unauthenticated). */
  initiateOAuth: ({ provider, redirectAfterAuth }: { provider: string; redirectAfterAuth?: string }) => Promise<void>;
  /** Link a new OAuth provider to the current authenticated user. */
  linkOAuthProvider: ({ provider, redirectAfterAuth }: { provider: string; redirectAfterAuth?: string }) => Promise<void>;
  /** Call on the callback page to extract tokens from the URL fragment. */
  handleOAuthCallback: () => boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Web-only hook for OAuth sign-in and identity linking.
 * Uses window.location for redirect-based OAuth flow.
 *
 * Usage (sign-in):
 *   const { initiateOAuth, handleOAuthCallback } = useOAuthSignIn();
 *   await initiateOAuth("google", "https://myapp.com/auth/callback");
 *
 * Usage (link provider to current user):
 *   const { linkOAuthProvider, handleOAuthCallback } = useOAuthSignIn();
 *   await linkOAuthProvider("github", "https://myapp.com/settings");
 *
 * On the callback page (component mount):
 *   useEffect(() => { handleOAuthCallback(); }, []);
 */
function useOAuthSignIn(): UseOAuthSignInReturn {
  const { projectId } = useProject();
  const dispatch = useReplykeDispatch();
  const accessToken = useReplykeSelector(selectAccessToken);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared helper for both /authorize and /link endpoints
  const startOAuthFlow = useCallback(
    async (endpoint: "authorize" | "link", provider: string, redirectAfterAuth?: string) => {
      if (!projectId) {
        setError("No projectId available.");
        return;
      }

      if (endpoint === "link" && !accessToken) {
        setError("Must be authenticated to link an OAuth provider.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const redirect = redirectAfterAuth || window.location.href;

        // /authorize is unauthenticated, /link requires the access token
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (endpoint === "link") {
          headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const response = await fetch(
          `${getApiBaseUrl()}/${projectId}/oauth/${endpoint}`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ provider, redirectAfterAuth: redirect }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to initiate OAuth");
        }

        const data = await response.json();

        // Redirect browser to provider's authorization page.
        // isLoading intentionally stays true since we're navigating away.
        window.location.href = data.authorizationUrl;
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    },
    [projectId, accessToken]
  );

  const initiateOAuth = useCallback(
    ({ provider, redirectAfterAuth }: { provider: string; redirectAfterAuth?: string }) =>
      startOAuthFlow("authorize", provider, redirectAfterAuth),
    [startOAuthFlow]
  );

  const linkOAuthProvider = useCallback(
    ({ provider, redirectAfterAuth }: { provider: string; redirectAfterAuth?: string }) =>
      startOAuthFlow("link", provider, redirectAfterAuth),
    [startOAuthFlow]
  );

  const handleOAuthCallback = useCallback((): boolean => {
    // Tokens arrive in the URL fragment (#accessToken=...&refreshToken=...)
    // Errors arrive in query params (?error=...&error_description=...)
    const hash = window.location.hash.substring(1); // Remove leading #
    const fragmentParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const fragmentAccessToken = fragmentParams.get("accessToken");
    const refreshToken = fragmentParams.get("refreshToken");
    const oauthError = queryParams.get("error");

    if (oauthError) {
      setError(queryParams.get("error_description") || oauthError);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      return false;
    }

    if (fragmentAccessToken && refreshToken) {
      // Store tokens in Redux. The AccountManager (via useAccountSync)
      // will detect the new tokens and persist them to localStorage.
      dispatch(setTokens({ accessToken: fragmentAccessToken, refreshToken }));
      dispatch(setInitialized(true));

      // Fetch user profile so useAccountSync can persist the account.
      // The thunk reads the just-set refresh token from Redux, calls the
      // server, and dispatches setUser + setUserInUserSlice on success.
      if (projectId) {
        dispatch(requestNewAccessTokenThunk({ projectId }));
      }

      // Clean URL (remove fragment with tokens)
      window.history.replaceState({}, "", window.location.pathname);
      return true;
    }

    return false;
  }, [dispatch, projectId]);

  return { initiateOAuth, linkOAuthProvider, handleOAuthCallback, isLoading, error };
}

export default useOAuthSignIn;
