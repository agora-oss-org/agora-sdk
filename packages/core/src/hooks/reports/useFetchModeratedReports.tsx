import { useCallback } from "react";
import useProject from "../projects/useProject";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import { PaginatedResponse } from "../../interfaces/PaginatedResponse";
import { Entity } from "../../interfaces/models/Entity";
import { Comment } from "../../interfaces/models/Comment";
import { Space } from "../../interfaces/models/Space";
import { SpaceReputationContextParams } from "../../interfaces/SpaceReputation";
import { buildSpaceReputationParams } from "../../utils/spaceReputationParams";

export interface FetchModeratedReportsParams extends SpaceReputationContextParams {
  spaceId?: string;
  targetType?: "comment" | "entity";
  status?: "pending" | "on-hold" | "escalated" | "dismissed" | "actioned";
  sortBy?: "new" | "old";
  page?: number;
  limit?: number;
}

export interface ReportUserReport {
  id: string;
  userId: string;
  reason: string;
  details: string | null;
  createdAt: string;
}

export interface Report {
  id: string;
  projectId: string;
  spaceId: string | null;
  targetId: string;
  targetType: "comment" | "entity";
  reporterCount: number;
  userReports: ReportUserReport[];
  status: "pending" | "on-hold" | "escalated" | "dismissed" | "actioned";
  actionTaken: string | null;
  target: Entity | Comment | null;
  space: Space | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Hook to fetch reports for spaces the user can moderate
 *
 * If spaceId is provided, returns reports for that specific space
 * If spaceId is omitted, returns reports from ALL spaces the user moderates
 *
 * @example
 * const fetchModeratedReports = useFetchModeratedReports();
 *
 * // Fetch reports for a specific space
 * const reports = await fetchModeratedReports({
 *   spaceId: "space-uuid",
 *   targetType: "entity",
 *   page: 1,
 *   limit: 20
 * });
 *
 * // Fetch reports from ALL spaces the user moderates
 * const allReports = await fetchModeratedReports({
 *   page: 1,
 *   limit: 20
 * });
 */
function useFetchModeratedReports(): (params: FetchModeratedReportsParams) => Promise<PaginatedResponse<Report>> {
  const { projectId } = useProject();
  const axios = useAxiosPrivate();

  const fetchModeratedReports = useCallback(
    async ({
      spaceId,
      targetType,
      status,
      sortBy,
      page,
      limit,
      spaceReputation,
      spaceReputationId,
      spaceReputationDescendants,
    }: FetchModeratedReportsParams) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const params: Record<string, any> = {
        spaceId,
        targetType,
        status,
        sortBy,
        page,
        limit,
        ...buildSpaceReputationParams({
          spaceReputation,
          spaceReputationId,
          spaceReputationDescendants,
        }),
      };

      const response = await axios.get<PaginatedResponse<Report>>(
        `/${projectId}/reports/moderated`,
        { params }
      );

      return response.data;
    },
    [projectId, axios]
  );

  return fetchModeratedReports;
}

export default useFetchModeratedReports;
