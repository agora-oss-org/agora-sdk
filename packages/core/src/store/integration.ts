/**
 * Integration utilities for users who want to use their own Redux store.
 *
 * @example
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import {
 *   replykeReducers,
 *   replykeApiReducer,
 *   replykeMiddleware
 * } from '@agora/react-js';
 *
 * const store = configureStore({
 *   reducer: {
 *     replyke: replykeReducers,
 *     replykeApi: replykeApiReducer,
 *     ...yourReducers
 *   },
 *   middleware: (getDefault) => getDefault().concat(...replykeMiddleware)
 * });
 * ```
 */

// Feature reducers (combined under 'replyke' key)
export { replykeReducers, type ReplykeState } from "./replykeReducers";

// RTK Query API reducer and middleware
export {
  baseApi as replykeApi,
  replykeApiReducer,
  replykeApiMiddleware,
} from "./api/baseApi";

// Custom middleware (error handling, logging)
export { customMiddleware as replykeCustomMiddleware } from "./middleware";

// Import for combined middleware array
import { baseApi } from "./api/baseApi";
import { customMiddleware } from "./middleware";

/**
 * Combined middleware array for convenience.
 * Spread this into your middleware chain.
 *
 * @example
 * ```typescript
 * middleware: (getDefault) => getDefault().concat(...replykeMiddleware)
 * ```
 */
export const replykeMiddleware = [
  baseApi.middleware,
  ...customMiddleware,
];
