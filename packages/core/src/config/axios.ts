// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — base URL injected at runtime (see config/runtime.ts).
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.

import axios from "axios";
import { getApiBaseUrl } from "./runtime";

// Base URL is read LAZILY per request (the consuming app sets it via <ReplykeProvider baseUrl>),
// so a request interceptor stamps `baseURL` on every call rather than baking it at module load.
const withRuntimeBaseUrl = (instance: ReturnType<typeof axios.create>) => {
  instance.interceptors.request.use((config) => {
    config.baseURL = getApiBaseUrl();
    return config;
  });
  return instance;
};

const axiosInstance = withRuntimeBaseUrl(axios.create());

export const axiosPrivate = withRuntimeBaseUrl(
  axios.create({ headers: { "Content-Type": "application/json" } })
);

export default axiosInstance;
