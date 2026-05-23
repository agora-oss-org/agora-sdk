import axios from "axios";
import { getApiBaseUrl } from "../utils/env";

// Env-driven (REACT_APP_API_BASE_URL / VITE_API_BASE_URL), defaults to the local Agora server.
// Drives the REST client, the chat socket.io origin, and semantic search.
export const BASE_URL = getApiBaseUrl();

export default axios.create({
  baseURL: BASE_URL,
});

export const axiosPrivate = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});
