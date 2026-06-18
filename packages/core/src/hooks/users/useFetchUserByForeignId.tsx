import { useCallback } from "react";

import useProject from "../projects/useProject";
import axios from "../../config/axios";
import { User, UserIncludeParam } from "../../interfaces/models/User";

export interface FetchUserByForeignIdProps {
  foreignId: string;
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

function useFetchUserByForeignId(): (props: FetchUserByForeignIdProps) => Promise<User> {
  const { projectId } = useProject();

  const fetchUserByForeignId = useCallback(
    async ({
      foreignId,
      include,
      spaceReputationId,
      spaceReputationDescendants,
    }: FetchUserByForeignIdProps) => {
      if (!projectId) {
        throw new Error("No project specified");
      }

      if (!foreignId) {
        throw new Error("Please specify a foreign ID");
      }

      const params: Record<string, any> = {
        foreignId,
        include: Array.isArray(include) ? include.join(",") : include,
      };
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get(`/${projectId}/users/by-foreign-id`, {
        params,
      });

      return response.data as User;
    },
    [projectId]
  );

  return fetchUserByForeignId;
}

export default useFetchUserByForeignId;
