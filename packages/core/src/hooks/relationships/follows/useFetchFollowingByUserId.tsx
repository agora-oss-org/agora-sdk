import { useCallback } from "react";
import useProject from "../../projects/useProject";
import type { User } from "../../../interfaces/models/User";
import { PaginatedResponse } from "../../../interfaces/PaginatedResponse";
import axios from "../../../config/axios";

export interface FollowingWithFollowInfo {
  followId: string;
  user: User;
  followedAt: string;
}

export interface FetchFollowingByUserIdParams {
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

function useFetchFollowingByUserId(): (params: FetchFollowingByUserIdParams) => Promise<PaginatedResponse<FollowingWithFollowInfo>> {
  const { projectId } = useProject();

  const fetchFollowingByUserId = useCallback(
    async ({ userId, page = 1, limit = 20, spaceReputationId, spaceReputationDescendants }: FetchFollowingByUserIdParams) => {
      if (!userId) {
        throw new Error("No userId provided.");
      }

      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const params: Record<string, any> = { page, limit };
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get<PaginatedResponse<FollowingWithFollowInfo>>(
        `/${projectId}/users/${userId}/following`,
        {
          params,
        }
      );

      return response.data;
    },
    [projectId]
  );

  return fetchFollowingByUserId;
}

export default useFetchFollowingByUserId;
