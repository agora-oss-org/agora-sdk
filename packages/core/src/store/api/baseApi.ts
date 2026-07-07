// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — resolve the API base URL at request time
// via a dynamic fetchBaseQuery so the injected baseUrl always wins.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getApiBaseUrl } from "../../config/runtime";

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
const dynamicBaseQuery: ReturnType<typeof fetchBaseQuery> = (args, api, extraOptions) =>
  fetchBaseQuery({ baseUrl: getApiBaseUrl(), prepareHeaders })(args, api, extraOptions);

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