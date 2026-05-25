// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — re-export the new SignUpResult type.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
export { default as useAuth, type UseAuthValues, type SignUpWithEmailAndPasswordProps, type SignInWithEmailAndPasswordProps, type ChangePasswordProps, type SignUpResult } from './useAuth';
export { default as useAccountSync } from './useAccountSync';
export { default as useAccounts, type UseAccountsReturn } from './useAccounts';
export { default as useSwitchAccount, type UseSwitchAccountReturn } from './useSwitchAccount';
export { default as useAddAccount, type UseAddAccountReturn } from './useAddAccount';
export { default as useRemoveAccount, type UseRemoveAccountReturn } from './useRemoveAccount';
export { default as useSignOutAll, type UseSignOutAllReturn } from './useSignOutAll';
export { default as useRequestPasswordReset, type RequestPasswordResetProps } from './useRequestPasswordReset';
export { default as useSendVerificationEmail, type SendVerificationEmailProps } from './useSendVerificationEmail';
export { default as useVerifyEmail, type VerifyEmailProps } from './useVerifyEmail';
export { default as useOAuthIdentities, type OAuthIdentity, type UseOAuthIdentitiesReturn } from './useOAuthIdentities';
