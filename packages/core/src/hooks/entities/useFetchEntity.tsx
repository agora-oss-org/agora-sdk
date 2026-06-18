import { useCallback } from "react";
import useProject from "../projects/useProject";
import { Entity, EntityIncludeParam } from "../../interfaces/models/Entity";
import useAxiosPrivate from "../../config/useAxiosPrivate";

export interface FetchEntityProps {
  entityId: string;
  include?: EntityIncludeParam;
  /**
   * Opt into per-row `spaceReputation` on embedded users. Accepted forms: a
   * space `<uuid>`, `"none"`, or `"context"`.
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

function useFetchEntity(): (props: FetchEntityProps) => Promise<Entity> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const fetchEntity = useCallback(
    async ({ entityId, include, spaceReputationId, spaceReputationDescendants }: FetchEntityProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      if (!entityId) {
        throw new Error("Please pass an entityId");
      }

      const params: Record<string, any> = {
        include: Array.isArray(include) ? include.join(",") : include,
      };
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined)
        params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get(`/${projectId}/entities/${entityId}`, {
        params,
      });

      return response.data as Entity;
    },
    [projectId],
  );

  return fetchEntity;
}

export default useFetchEntity;
