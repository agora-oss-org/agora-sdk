import { useCallback } from "react";
import useProject from "../projects/useProject";
import {
  SpaceMembersResponse,
  SpaceMemberRole,
  SpaceMemberStatus,
} from "../../interfaces/models/SpaceMember";
import useAxiosPrivate from "../../config/useAxiosPrivate";

export interface FetchSpaceMembersProps {
  spaceId: string;
  page?: number;
  limit?: number;
  role?: SpaceMemberRole;
  status?: SpaceMemberStatus;
  /**
   * Opt into per-row `spaceReputation` on embedded users. Accepted forms: a
   * space `<uuid>`, `"none"`, or `"context"`.
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

function useFetchSpaceMembers(): (props: FetchSpaceMembersProps) => Promise<SpaceMembersResponse> {
  const { projectId } = useProject();
  const axios = useAxiosPrivate();

  const fetchSpaceMembers = useCallback(
    async ({ spaceId, page, limit, role, status, spaceReputationId, spaceReputationDescendants }: FetchSpaceMembersProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      if (!spaceId) {
        throw new Error("Please pass a spaceId");
      }

      const params: Record<string, any> = { page, limit, role, status };
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get<SpaceMembersResponse>(
        `/${projectId}/spaces/${spaceId}/members`,
        { params }
      );

      return response.data;
    },
    [projectId, axios]
  );

  return fetchSpaceMembers;
}

export default useFetchSpaceMembers;
