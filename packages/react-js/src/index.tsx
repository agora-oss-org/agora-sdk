import React from "react";
import { ReplykeProvider as CoreReplykeProvider } from "@agora/core";
import AccountManager from "./AccountManager";

// Re-export all exports from @agora/core
export * from "@agora/core";

// Web-only OAuth hook (uses window.location for redirect-based flow)
export { default as useOAuthSignIn, type UseOAuthSignInReturn } from "./hooks/useOAuthSignIn";

// Override ReplykeProvider to inject AccountManager
export const ReplykeProvider: React.FC<{
  projectId: string;
  signedToken?: string | null | undefined;
  children: React.ReactNode;
}> = ({ projectId, signedToken, children }) => {
  return (
    <CoreReplykeProvider projectId={projectId} signedToken={signedToken}>
      <>
        <AccountManager />
        {children}
      </>
    </CoreReplykeProvider>
  );
};
