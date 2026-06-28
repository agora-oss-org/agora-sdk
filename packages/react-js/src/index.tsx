import React from "react";
import { ReplykeProvider as CoreReplykeProvider } from "@agora-sdk/core";
import AccountManager from "./AccountManager";

// Re-export all exports from @agora-sdk/core
export * from "@agora-sdk/core";

// Web-only OAuth hook (uses window.location for redirect-based flow)
export { default as useOAuthSignIn, type UseOAuthSignInReturn } from "./hooks/useOAuthSignIn";

// Web Push adapter (browser Notification + Push API, no native dependencies)
export { webPushTokenAdapter } from "./PushTokenAdapter";

// Override ReplykeProvider to inject AccountManager
export const ReplykeProvider: React.FC<{
  projectId: string;
  signedToken?: string | null | undefined;
  /** Agora server base URL incl. /v7 (e.g. https://host/v7). Defaults to http://localhost:4000/v7. */
  baseUrl?: string;
  children: React.ReactNode;
}> = ({ projectId, signedToken, baseUrl, children }) => {
  return (
    <CoreReplykeProvider projectId={projectId} signedToken={signedToken} baseUrl={baseUrl}>
      <>
        <AccountManager />
        {children}
      </>
    </CoreReplykeProvider>
  );
};
