// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — sends `emailRedirectTo` so the emailed
// reset link returns the user to the front-end that initiated the request.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.

import { useCallback } from "react";
import axios from "../../config/axios";
import useProject from "../projects/useProject";
import { getEmailRedirectTo } from "../../config/runtime";

export interface RequestPasswordResetProps {
  email: string;
}

function useRequestPasswordReset(): (props: RequestPasswordResetProps) => Promise<{ success: boolean; message: string }> {
  const { projectId } = useProject();

  const requestPasswordReset = useCallback(
    async ({ email }: RequestPasswordResetProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      if (!email?.trim()) {
        throw new Error("Email is required.");
      }

      const emailRedirectTo = getEmailRedirectTo();
      const response = await axios.post(
        `/${projectId}/auth/request-password-reset`,
        {
          email: email.trim(),
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        }
      );

      return response.data;
    },
    [projectId]
  );

  return requestPasswordReset;
}

export default useRequestPasswordReset;
