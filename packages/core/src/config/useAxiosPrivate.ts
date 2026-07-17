// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — the reactive refresh interceptor now triggers on
// HTTP 401 (the Agora server's response for an expired/invalid access token) instead of 403.
// Upstream Replyke refreshes on 403, but the Agora server reserves 403 for genuine authorization
// denials (members-only spaces, ownership/operator gates); 401 means "credentials expired",
// which is the correct, spec-compliant trigger for a token refresh (RFC 9110 / RFC 6750).
// Divergence #8 additions: no "Bearer null" header when signed out (the Agora server 401s
// garbage tokens instead of treating them as anonymous), and the reactive refresh routes
// through the shared single-flight in config/runtime.ts so this handler, the module-level
// one in config/axios.ts, and RTK Query can never race concurrent refresh-token rotations.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import { useEffect } from "react";
import type { AxiosInstance } from "axios";
import { axiosPrivate } from "./axios";
import { useAuth } from "../hooks/auth";
import { refreshAccessToken } from "./runtime";

const useAxiosPrivate = (): AxiosInstance => {
  const { accessToken, requestNewAccessToken } = useAuth();

  useEffect(() => {
    const requestIntercept = axiosPrivate.interceptors.request.use(
      (config) => {
        if (config.headers["Authorization"]) return config;
        if (accessToken) config.headers["Authorization"] = `Bearer ${accessToken}`;
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseIntercept = axiosPrivate.interceptors.response.use(
      (response) => response,
      async (error) => {
        const prevRequest = error?.config;
        // 401 = expired/invalid access token → refresh and retry. (Upstream keyed off 403, but the
        // Agora server returns 401 on expiry and uses 403 for authorization denials, which must NOT
        // trigger a refresh — refreshing wouldn't grant access and would spam the refresh endpoint.)
        if (error?.response?.status === 401 && !prevRequest?.sent) {
          prevRequest.sent = true;

          // Shared single-flight (config/runtime.ts): one refresh at a time process-wide.
          const newAccessToken = await refreshAccessToken(
            () => requestNewAccessToken?.() ?? Promise.resolve(undefined)
          );

          if (!newAccessToken) {
            return Promise.reject(error);
          }

          prevRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
          return axiosPrivate(prevRequest);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axiosPrivate.interceptors.request.eject(requestIntercept);
      axiosPrivate.interceptors.response.eject(responseIntercept);
    };
  }, [accessToken, requestNewAccessToken]);

  return axiosPrivate;
};

export default useAxiosPrivate;
