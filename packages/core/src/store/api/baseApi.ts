// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — resolve the API base URL at request time
// via a dynamic fetchBaseQuery so the injected baseUrl always wins; divergence #8: park
// on the auth boot latch and retry once through the shared refresh on 401.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  getApiBaseUrl,
  whenAuthSettled,
  hasTokenRefresher,
  refreshAccessToken,
} from "../../config/runtime";

// Type for state that includes replyke namespace
// Used by prepareHeaders to access auth token from namespaced state
interface StateWithReplyke {
  replyke: {
    auth: {
      accessToken: string | null;
    };
  };
}

const prepareHeaders = (headers: Headers, { getState }: { getState: () => unknown }) => {
  headers.set('Content-Type', 'application/json');
  const state = getState() as StateWithReplyke;
  const accessToken = state.replyke?.auth?.accessToken;
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
};

// Base URL is injected at runtime (config/runtime.ts), so resolve it per request rather than at
// store-creation time: build fetchBaseQuery on each call with the current base URL. Typed as
// fetchBaseQuery's own return so injected endpoints keep their request/response/meta inference.
// Agora divergence #8: park on the boot latch until auth init settles, and retry once through
// the shared single-flight refresh on 401 (RTK Query had no reactive refresh path of its own).
// Exported for tests.
export const dynamicBaseQuery: ReturnType<typeof fetchBaseQuery> = async (
  args,
  api,
  extraOptions
) => {
  await whenAuthSettled();
  const run = () =>
    fetchBaseQuery({ baseUrl: getApiBaseUrl(), prepareHeaders })(args, api, extraOptions);

  let result = await run();
  if (result.error?.status === 401 && hasTokenRefresher()) {
    const newAccessToken = await refreshAccessToken();
    // prepareHeaders re-reads the rotated token from state on the re-run.
    if (newAccessToken) result = await run();
  }
  return result;
};

// Create the base API slice
export const baseApi = createApi({
  reducerPath: 'replykeApi',
  baseQuery: dynamicBaseQuery,
  tagTypes: [
    'AppNotification',
    'Collection',
    'CollectionEntities',
    'User',
    'Entity',
    'Space',
    'SpaceMember',
    'TableRow',
    'NotificationPreferences',
    // Future tag types:
    // 'Comment',
  ],
  endpoints: () => ({}), // Endpoints will be injected by feature APIs
});

// Export hooks for use in components (will be populated by injected endpoints)
export const {} = baseApi;

// Exports for integration mode (users who have their own Redux store)
export const replykeApiReducer = baseApi.reducer;
export const replykeApiMiddleware = baseApi.middleware;