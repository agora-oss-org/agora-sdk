import { useCallback } from "react";
import useProject from "../../projects/useProject";
import { EstablishedConnection } from "../../../interfaces/models/Connection";
import { PaginatedResponse } from "../../../interfaces/PaginatedResponse";
import axios from "../../../config/axios";

export interface FetchConnectionsByUserIdParams {
  userId: string;
  page?: number;
  limit?: number;
  /**
   * Opt into `spaceReputation` on the returned users. Accepted forms: a space
   * `<uuid>` or `"none"`. `"context"` is rejected by the server (400) — this
   * by-user-id graph read has no per-row space context.
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

function useFetchConnectionsByUserId(): (props: FetchConnectionsByUserIdParams) => Promise<PaginatedResponse<EstablishedConnection>> {
  const { projectId } = useProject();

  const fetchConnectionsByUserId = useCallback(
    async (
      props: FetchConnectionsByUserIdParams
    ): Promise<PaginatedResponse<EstablishedConnection>> => {
      const { userId, page = 1, limit = 20, spaceReputationId, spaceReputationDescendants } = props;
      if (!projectId) {
        throw new Error("No project specified");
      }

      if (!userId) {
        throw new Error("No user ID was provided");
      }

      const params: Record<string, any> = { page, limit };
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get<PaginatedResponse<EstablishedConnection>>(
        `/users/${userId}/connections`,
        {
          params,
        }
      );

      return response.data;
    },
    [projectId]
  );

  return fetchConnectionsByUserId;
}

export default useFetchConnectionsByUserId;
