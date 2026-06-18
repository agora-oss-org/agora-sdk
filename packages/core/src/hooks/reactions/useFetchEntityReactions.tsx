import { useCallback } from "react";
import { Reaction, ReactionType } from "../../interfaces/models/Reaction";
import { PaginatedResponse } from "../../interfaces/PaginatedResponse";
import useProject from "../projects/useProject";
import axios from "../../config/axios";

export interface FetchEntityReactionsProps {
  entityId: string;
  page: number;
  limit?: number;
  reactionType?: ReactionType;
  sortDir?: "asc" | "desc";
  /**
   * Opt into per-row `spaceReputation` on embedded users. Accepted forms: a
   * space `<uuid>`, `"none"`, or `"context"`.
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

function useFetchEntityReactions(): (props: FetchEntityReactionsProps) => Promise<PaginatedResponse<Reaction>> {
  const { projectId } = useProject();

  const fetchEntityReactions = useCallback(
    async (props: FetchEntityReactionsProps): Promise<PaginatedResponse<Reaction>> => {
      const { entityId, page, limit = 20, reactionType, sortDir = "desc", spaceReputationId, spaceReputationDescendants } = props;

      if (page === 0) {
        throw new Error("Can't fetch reactions with page 0");
      }

      if (limit === 0) {
        throw new Error("Can't fetch with limit 0");
      }

      if (!projectId) {
        throw new Error("No project specified");
      }

      if (!entityId) {
        throw new Error("No entity ID provided");
      }

      const params: Record<string, any> = {
        page,
        limit,
        sortDir,
      };

      if (reactionType) {
        params.reactionType = reactionType;
      }
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get<PaginatedResponse<Reaction>>(
        `/${projectId}/entities/${entityId}/reactions`,
        { params }
      );

      return response.data;
    },
    [projectId]
  );

  return fetchEntityReactions;
}

export default useFetchEntityReactions;
