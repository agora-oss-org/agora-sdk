import { useCallback } from "react";

import useProject from "../projects/useProject";
import axios from "../../config/axios";
import { User, UserIncludeParam } from "../../interfaces/models/User";

export interface FetchUserProps {
  userId: string;
  include?: UserIncludeParam;
  /**
   * Opt into `spaceReputation` on the returned user. Accepted forms: a space
   * `<uuid>` or `"none"`. `"context"` is rejected by the server (400) on this
   * bare user lookup — there is no row context to derive a space from.
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

function useFetchUser(): (props: FetchUserProps) => Promise<User> {
  const { projectId } = useProject();

  const fetchUser = useCallback(
    async ({
      userId,
      include,
      spaceReputationId,
      spaceReputationDescendants,
    }: FetchUserProps) => {
      if (!projectId) {
        throw new Error("No project specified");
      }

      if (!userId) {
        throw new Error("Please specify a user ID");
      }

      const params: Record<string, any> = {
        include: Array.isArray(include) ? include.join(",") : include,
      };
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get(`/${projectId}/users/${userId}`, {
        params,
      });

      return response.data as User;
    },
    [projectId]
  );

  return fetchUser;
}

export default useFetchUser;
