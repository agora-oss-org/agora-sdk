import React from "react";
import { ReplykeProvider as OriginalReplykeProvider } from "@agora-sdk/core";

// Re-export all exports from @agora-sdk/core
export * from "@agora-sdk/core";
import AccountManager from "./AccountManager";

// Expo-specific OAuth hook (system browser + deep-link return)
export { default as useOAuthSignIn, type UseOAuthSignInReturn } from "./hooks/useOAuthSignIn";

// Expo-specific PushTokenAdapter (expo-notifications)
export { expoPushTokenAdapter } from "./PushTokenAdapter";

// Override ReplykeProvider
export const ReplykeProvider: React.FC<{
  projectId: string;
  signedToken?: string | null | undefined;
  children: React.ReactNode;
}> = ({ projectId, signedToken, children }) => {
  return (
    <OriginalReplykeProvider projectId={projectId} signedToken={signedToken}>
      <>
        <AccountManager />
        {children}
      </>
    </OriginalReplykeProvider>
  );
};
