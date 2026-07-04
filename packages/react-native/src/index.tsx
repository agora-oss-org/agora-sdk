import React from "react";
import { ReplykeProvider as OriginalReplykeProvider } from "@agora-sdk/core";

// Re-export all exports from @agora-sdk/core
export * from "@agora-sdk/core";
import AccountManager from "./AccountManager";

// React Native-specific PushTokenAdapter (@react-native-firebase/messaging)
export { reactNativePushTokenAdapter } from "./PushTokenAdapter";

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

// Agora divergence #7: additive alias so RN consumers can write <AgoraProvider>.
// Points at the local override (with AccountManager), shadowing core's alias.
// See CLAUDE.md / SYNCING.md #7.
export const AgoraProvider = ReplykeProvider;
