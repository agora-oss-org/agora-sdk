// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — arms the auth boot latch during render (divergence #8).
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.

import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useReplykeDispatch, useReplykeSelector } from "../store/hooks";
import { initializeAuthThunk } from "../store/slices/authThunks";
import {
  selectAccountsReady,
  selectAccountManagerRegistered,
} from "../store/slices/accountsSlice";
import { selectInitialized } from "../store/slices/authSlice";
import { ReplykeContext } from "./replyke-context";
import useProjectData from "../hooks/projects/useProjectData";
import { setApiBaseUrl, armAuthLatch, markAuthSettled } from "../config/runtime";

export interface ReplykeIntegrationProviderProps {
  children: ReactNode;
  projectId: string;
  signedToken?: string | null;
  /** Agora server base URL incl. /v7; defaults to http://localhost:4000/v7 when omitted. */
  baseUrl?: string;
}

/**
 * Component that initializes auth state in Redux.
 * Must be inside a Redux Provider to dispatch actions.
 */
const AuthInitializer: React.FC<{
  children: ReactNode;
  projectId: string;
  signedToken?: string | null;
}> = ({ children, projectId, signedToken }) => {
  const dispatch = useReplykeDispatch();
  const accountsReady = useReplykeSelector(selectAccountsReady);
  const accountManagerRegistered = useReplykeSelector(selectAccountManagerRegistered);
  const initialized = useReplykeSelector(selectInitialized);
  const [hasWaitedForManager, setHasWaitedForManager] = useState(false);

  // Give AccountManager one microtask to register itself
  useEffect(() => {
    Promise.resolve().then(() => setHasWaitedForManager(true));
  }, []);

  useEffect(() => {
    // Auth already bootstrapped (e.g. by OAuth callback, or redux-persist rehydration) — skip
    // dispatching initializeAuthThunk. But skipping the thunk also skips its `finally`, which is
    // the ONLY place that releases the boot latch (armAuthLatch() ran unconditionally during this
    // provider's render) — so release it here too, or every parked content request hangs forever.
    if (initialized) {
      markAuthSettled();
      return;
    }

    // Still waiting for the microtask check
    if (!hasWaitedForManager) return;

    // If an AccountManager registered, wait until it signals ready
    if (accountManagerRegistered && !accountsReady) return;

    // Either: no AccountManager (core-only user) OR AccountManager is ready
    dispatch(initializeAuthThunk({ projectId, signedToken }));
  }, [dispatch, projectId, signedToken, hasWaitedForManager, accountManagerRegistered, accountsReady, initialized]);

  return <>{children}</>;
};

/**
 * Integration provider for Replyke (Integration Mode).
 *
 * Use this when you HAVE your own Redux store and want to integrate
 * Replyke's reducers into it. This provider does NOT create a Redux store -
 * you must wrap your app with your own Redux Provider.
 *
 * Prerequisites:
 * 1. Add replykeReducers under the 'replyke' key in your store
 * 2. Add replykeApiReducer under the 'replykeApi' key
 * 3. Add replykeMiddleware to your middleware chain
 *
 * @example
 * ```tsx
 * import { configureStore } from '@reduxjs/toolkit';
 * import { Provider } from 'react-redux';
 * import {
 *   ReplykeIntegrationProvider,
 *   replykeReducers,
 *   replykeApiReducer,
 *   replykeMiddleware
 * } from '@agora-sdk/react-js';
 *
 * const store = configureStore({
 *   reducer: {
 *     replyke: replykeReducers,
 *     replykeApi: replykeApiReducer,
 *     ...yourReducers
 *   },
 *   middleware: (getDefault) => getDefault().concat(...replykeMiddleware)
 * });
 *
 * function App() {
 *   return (
 *     <Provider store={store}>
 *       <ReplykeIntegrationProvider projectId="..." signedToken={token}>
 *         <YourApp />
 *       </ReplykeIntegrationProvider>
 *     </Provider>
 *   );
 * }
 * ```
 */
export const ReplykeIntegrationProvider: React.FC<ReplykeIntegrationProviderProps> = ({
  children,
  projectId,
  signedToken,
  baseUrl,
}) => {
  // Set the runtime base URL during render, before any hook fires a request.
  setApiBaseUrl(baseUrl);

  // Provide projectId via context so hooks can access it
  const data = useProjectData({ projectId });

  // Agora divergence #8: arm the auth boot latch during render — parents render before children,
  // so this beats any child hook's first request effect. initializeAuthThunk releases it (or
  // AuthInitializer's terminal-skip path below). Must come after useProjectData, which is this
  // provider's projectId guard — arming before it would wedge the latch on a misconfigured app,
  // with nothing left alive to release it. (ReplykeProvider guards explicitly for the same reason.)
  armAuthLatch();

  // No Redux Provider here - user provides their own
  return (
    <ReplykeContext.Provider value={data}>
      <AuthInitializer projectId={projectId} signedToken={signedToken}>
        {children}
      </AuthInitializer>
    </ReplykeContext.Provider>
  );
};

export default ReplykeIntegrationProvider;
