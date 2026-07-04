// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — sends `emailRedirectTo` so the emailed
// confirmation link returns the user to the front-end that initiated the request.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.

import { useCallback } from "react";
import axios from "../../config/axios";
import useProject from "../projects/useProject";
import { getEmailRedirectTo } from "../../config/runtime";

export interface SendVerificationEmailProps {
  mode?: "code" | "link";
  tokenFormat?: "hex" | "numeric" | "alpha" | "alphanumeric";
  tokenLength?: number;
  redirectUrl?: string;
}

function useSendVerificationEmail(): (props?: SendVerificationEmailProps) => Promise<{ success: boolean }> {
  const { projectId } = useProject();

  const sendVerificationEmail = useCallback(
    async (props?: SendVerificationEmailProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const emailRedirectTo = getEmailRedirectTo();
      const response = await axios.post(
        `/${projectId}/auth/send-verification-email`,
        {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          ...props,
        }
      );

      return response.data;
    },
    [projectId]
  );

  return sendVerificationEmail;
}

export default useSendVerificationEmail;
