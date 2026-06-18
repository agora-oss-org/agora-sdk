import { useCallback } from "react";

import useProject from "../projects/useProject";
import axios from "../../config/axios";
import { User, UserIncludeParam } from "../../interfaces/models/User";

export interface FetchUserByUsernameProps {
  username: string;
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

function useFetchUserByUsername(): (props: FetchUserByUsernameProps) => Promise<User> {
  const { projectId } = useProject();

  const fetchUserByUsername = useCallback(
    async ({
      username,
      include,
      spaceReputationId,
      spaceReputationDescendants,
    }: FetchUserByUsernameProps) => {
      if (!projectId) {
        throw new Error("No project specified");
      }

      if (!username) {
        throw new Error("Please specify a username");
      }

      const params: Record<string, any> = {
        username,
        include: Array.isArray(include) ? include.join(",") : include,
      };
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get(`/${projectId}/users/by-username`, {
        params,
      });

      return response.data as User;
    },
    [projectId]
  );

  return fetchUserByUsername;
}

export default useFetchUserByUsername;
