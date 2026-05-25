// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — signUpWithEmailAndPassword resolves to a
// SignUpResult ({ status: "signed_in" | "confirmation_required" }) instead of void.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import { useCallback } from 'react';
import { useReplykeDispatch, useReplykeSelector } from '../../store/hooks';
import {
  selectAccessToken,
  selectRefreshToken,
  selectInitialized,
  setRefreshToken
} from '../../store/slices/authSlice';
import { 
  signUpWithEmailAndPasswordThunk,
  signInWithEmailAndPasswordThunk,
  signOutThunk,
  changePasswordThunk,
  requestNewAccessTokenThunk
} from '../../store/slices/authThunks';
import useProject from '../projects/useProject';

export interface SignUpWithEmailAndPasswordProps {
  email: string;
  password: string;
  name?: string;
  username?: string;
  avatar?: string;
  bio?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  birthdate?: Date;
  metadata?: Record<string, any>;
  secureMetadata?: Record<string, any>;
  avatarFile?: File | Blob;
  avatarOptions?: any;
  bannerFile?: File | Blob;
  bannerOptions?: any;
}

export interface SignInWithEmailAndPasswordProps {
  email: string;
  password: string;
}

export interface ChangePasswordProps {
  password: string;
  newPassword: string;
}

/**
 * Outcome of a sign-up. With email confirmation enabled the user is created but NOT signed in
 * (`confirmation_required`) — they must click the emailed link, then sign in. With auto-confirm
 * the user is signed in immediately (`signed_in`) and tokens are already in state.
 */
export type SignUpResult =
  | { status: "signed_in"; user: any }
  | { status: "confirmation_required"; email: string };

// Define the interface to match the original useAuth hook
export interface UseAuthValues {
  initialized: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  setRefreshToken: React.Dispatch<React.SetStateAction<string | null>>;
  signUpWithEmailAndPassword: (props: SignUpWithEmailAndPasswordProps) => Promise<SignUpResult>;
  signInWithEmailAndPassword: (props: SignInWithEmailAndPasswordProps) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (props: ChangePasswordProps) => Promise<void>;
  requestNewAccessToken: () => Promise<string | undefined>;
}

export default function useAuth(): UseAuthValues {
  const dispatch = useReplykeDispatch();
  const { projectId } = useProject();

  // Selectors
  const initialized = useReplykeSelector(selectInitialized);
  const accessToken = useReplykeSelector(selectAccessToken);
  const refreshToken = useReplykeSelector(selectRefreshToken);

  // Actions
  const handleSignUpWithEmailAndPassword = useCallback(
    async (props: SignUpWithEmailAndPasswordProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const result = await dispatch(signUpWithEmailAndPasswordThunk({
        projectId,
        ...props,
      }));

      if (signUpWithEmailAndPasswordThunk.rejected.match(result)) {
        throw new Error(result.payload as string);
      }

      return result.payload as SignUpResult;
    },
    [dispatch, projectId]
  );

  const handleSignInWithEmailAndPassword = useCallback(
    async (props: SignInWithEmailAndPasswordProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const result = await dispatch(signInWithEmailAndPasswordThunk({
        projectId,
        ...props,
      }));
      
      if (signInWithEmailAndPasswordThunk.rejected.match(result)) {
        throw new Error(result.payload as string);
      }
    },
    [dispatch, projectId]
  );

  const handleSignOut = useCallback(async () => {
    if (!projectId) {
      throw new Error("No projectId available.");
    }

    const result = await dispatch(signOutThunk({ projectId }));
    
    if (signOutThunk.rejected.match(result)) {
      throw new Error(result.payload as string);
    }
  }, [dispatch, projectId]);

  const handleChangePassword = useCallback(
    async (props: ChangePasswordProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const result = await dispatch(changePasswordThunk({
        projectId,
        ...props,
      }));
      
      if (changePasswordThunk.rejected.match(result)) {
        throw new Error(result.payload as string);
      }
    },
    [dispatch, projectId]
  );

  const handleRequestNewAccessToken = useCallback(async () => {
    if (!projectId) return;

    const result = await dispatch(requestNewAccessTokenThunk({ projectId }));
    
    if (requestNewAccessTokenThunk.fulfilled.match(result)) {
      return result.payload;
    }
  }, [dispatch, projectId]);

  const handleSetRefreshToken = useCallback((token: React.SetStateAction<string | null>) => {
    // Handle both direct value and function setter patterns
    if (typeof token === 'function') {
      const currentToken = refreshToken;
      const newToken = token(currentToken);
      dispatch(setRefreshToken(newToken));
    } else {
      dispatch(setRefreshToken(token));
    }
  }, [dispatch, refreshToken]);

  return {
    initialized,
    accessToken,
    refreshToken,
    setRefreshToken: handleSetRefreshToken,
    signUpWithEmailAndPassword: handleSignUpWithEmailAndPassword,
    signInWithEmailAndPassword: handleSignInWithEmailAndPassword,
    signOut: handleSignOut,
    changePassword: handleChangePassword,
    requestNewAccessToken: handleRequestNewAccessToken,
  };
}