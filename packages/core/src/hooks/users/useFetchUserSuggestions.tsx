import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { User } from "../../interfaces/models/User";
import { SpaceReputationUserParams } from "../../interfaces/SpaceReputation";
import { buildSpaceReputationParams } from "../../utils/spaceReputationParams";

export interface FetchUserSuggestionsProps extends SpaceReputationUserParams {
  query: string;
}

function useFetchUserSuggestions(): (props: FetchUserSuggestionsProps) => Promise<User[]> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const fetchUserSuggestions = useCallback(
    async ({ query, spaceReputation, spaceReputationId, spaceReputationDescendants }: FetchUserSuggestionsProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const params: Record<string, any> = {
        query,
        ...buildSpaceReputationParams({
          spaceReputation,
          spaceReputationId,
          spaceReputationDescendants,
        }),
      };

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
