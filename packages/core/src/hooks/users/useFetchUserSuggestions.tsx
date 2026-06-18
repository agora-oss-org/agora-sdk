import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { User } from "../../interfaces/models/User";

export interface FetchUserSuggestionsProps {
  query: string;
  /**
   * Opt into `spaceReputation` on the returned users. Accepted forms: a space
   * `<uuid>` or `"none"`. `"context"` is rejected by the server (400) on this
   * bare user lookup — there is no row context to derive a space from.
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

function useFetchUserSuggestions(): (props: FetchUserSuggestionsProps) => Promise<User[]> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const fetchUserSuggestions = useCallback(
    async ({ query, spaceReputationId, spaceReputationDescendants }: FetchUserSuggestionsProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const params: Record<string, any> = { query };
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get(`/${projectId}/users/suggestions`, {
        params,
      });

      return response.data as User[];
    },
    [axios, projectId]
  );

  return fetchUserSuggestions;
}

export default useFetchUserSuggestions;
