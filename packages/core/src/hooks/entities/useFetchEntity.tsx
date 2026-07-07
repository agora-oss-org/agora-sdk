import { useCallback } from "react";
import useProject from "../projects/useProject";
import { Entity, EntityIncludeParam } from "../../interfaces/models/Entity";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import { SpaceReputationContextParams } from "../../interfaces/SpaceReputation";
import { buildSpaceReputationParams } from "../../utils/spaceReputationParams";

export interface FetchEntityProps extends SpaceReputationContextParams {
  entityId: string;
  include?: EntityIncludeParam;
}

function useFetchEntity(): (props: FetchEntityProps) => Promise<Entity> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const fetchEntity = useCallback(
    async ({ entityId, include, spaceReputation, spaceReputationId, spaceReputationDescendants }: FetchEntityProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      if (!entityId) {
        throw new Error("Please pass an entityId");
      }

      const params: Record<string, any> = {
        include: Array.isArray(include) ? include.join(",") : include,
        ...buildSpaceReputationParams({
          spaceReputation,
          spaceReputationId,
          spaceReputationDescendants,
        }),
      };

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
