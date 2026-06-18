import { useCallback } from "react";
import useProject from "../projects/useProject";
import { SpaceTeamResponse } from "../../interfaces/models/SpaceMember";
import useAxiosPrivate from "../../config/useAxiosPrivate";

export interface FetchSpaceTeamProps {
  spaceId: string;
  /**
   * Opt into per-row `spaceReputation` on embedded users. Accepted forms: a
   * space `<uuid>`, `"none"`, or `"context"`.
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

// Fetches all admins and moderators of a space (no pagination)
function useFetchSpaceTeam(): (props: FetchSpaceTeamProps) => Promise<SpaceTeamResponse> {
  const { projectId } = useProject();
  const axios = useAxiosPrivate();

  const fetchSpaceTeam = useCallback(
    async ({ spaceId, spaceReputationId, spaceReputationDescendants }: FetchSpaceTeamProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      if (!spaceId) {
        throw new Error("Please pass a spaceId");
      }

      const url = `/${projectId}/spaces/${spaceId}/team`;

      const params: Record<string, any> = {};
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get<SpaceTeamResponse>(url, { params });

      return response.data;
    },
    [projectId, axios]
  );

  return fetchSpaceTeam;
}

export default useFetchSpaceTeam;
