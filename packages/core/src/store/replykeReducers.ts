import { combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import { appNotificationsSlice } from "./slices/appNotificationsSlice";
import collectionsReducer from "./slices/collectionsSlice";
import { userReducer } from "./slices/userSlice";
import entityListsReducer from "./slices/entityListsSlice";
import spaceListsReducer from "./slices/spaceListsSlice";
import accountsReducer from "./slices/accountsSlice";
import chatReducer from "./slices/chatSlice";
import tablesReducer from "./slices/tablesSlice";

/**
 * Combined reducer for all Replyke feature slices.
 * Used by both standalone mode (internal) and integration mode (user's store).
 *
 * For integration mode, add this to your store under the 'replyke' key:
 *
 * @example
 * ```typescript
 * import { replykeReducers, replykeApiReducer, replykeMiddleware } from '@agora-sdk/react-js';
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
export const replykeReducers = combineReducers({
  auth: authReducer,
  appNotifications: appNotificationsSlice.reducer,
  collections: collectionsReducer,
  user: userReducer,
  entityLists: entityListsReducer,
  spaceLists: spaceListsReducer,
  accounts: accountsReducer,
  chat: chatReducer,
  tables: tablesReducer,
});

export type ReplykeState = ReturnType<typeof replykeReducers>;
