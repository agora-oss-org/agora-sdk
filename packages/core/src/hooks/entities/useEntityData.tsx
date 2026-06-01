// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — useEntityData (and therefore EntityProvider) now
// accepts an optional `include` and forwards it to the single-entity fetch hooks, so a detail view
// can load related data such as the entity author (include=["user"]). `include` is also folded into
// the fetch cache key so changing it re-fetches. Additive and backward-compatible.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import { useCallback, useEffect, useRef, useState } from "react";

import useFetchEntity from "./useFetchEntity";
import useFetchEntityByForeignId from "./useFetchEntityByForeignId";
import useFetchEntityByShortId from "./useFetchEntityByShortId";
import useUpdateEntity, { UpdateEntityProps } from "./useUpdateEntity";
import useDeleteEntity from "./useDeleteEntity";

import { Entity, EntityIncludeParam } from "../../interfaces/models/Entity";
import { handleError } from "../../utils/handleError";

export type UseEntityDataProps =
  | {
      entity: Entity;
      entityId?: undefined;
      foreignId?: undefined;
      shortId?: undefined;
      createIfNotFound?: undefined;
      include?: undefined;
    }
  | {
      entity?: undefined;
      entityId: string;
      foreignId?: undefined;
      shortId?: undefined;
      createIfNotFound?: undefined;
      include?: EntityIncludeParam;
    }
  | {
      entity?: undefined;
      entityId?: undefined;
      foreignId?: undefined;
      shortId: string;
      createIfNotFound?: undefined;
      include?: EntityIncludeParam;
    }
  | {
      entity?: undefined;
      entityId?: undefined;
      foreignId: string;
      shortId?: undefined;
      createIfNotFound?: boolean;
      include?: EntityIncludeParam;
    };
export interface UseEntityDataValues {
  entity: Entity | null | undefined;
  setEntity: React.Dispatch<React.SetStateAction<Entity | null | undefined>>;
  updateEntity(
    props: Pick<UpdateEntityProps, "update">,
  ): Promise<Entity | undefined>;
  deleteEntity: () => Promise<void>;
}

function useEntityData({
  entityId,
  foreignId,
  shortId,
  entity: entityProp,
  createIfNotFound,
  include,
}: UseEntityDataProps): UseEntityDataValues {
  const [entity, setEntity] = useState<Entity | undefined | null>(entityProp);

  // Cache to store fetched entities keyed by unique identifier
  const entityCache = useRef<Record<string, Entity>>({});

  const fetchEntity = useFetchEntity();
  const fetchEntityByForeignId = useFetchEntityByForeignId();
  const fetchEntityByShortId = useFetchEntityByShortId();

  const updateEntity = useUpdateEntity();
  const deleteEntity = useDeleteEntity();

  const handleUpdateEntity = useCallback(
    async ({ update }: Pick<UpdateEntityProps, "update">) => {
      if (!entity) return;
      try {
        const newEntity = await updateEntity({
          entityId: entity.id,
          update,
        });
        if (newEntity) setEntity(newEntity);
        return newEntity;
      } catch (err) {
        handleError(err, "Failed to update entity");
      }
    },
    [entity, updateEntity],
  );

  const handleDeleteEntity = useCallback(async () => {
    if (!entity) return;

    try {
      await deleteEntity({ entityId: entity.id });
      setEntity(undefined);
    } catch (err) {
      handleError(err, "Failed to delete entity");
    }
  }, [entity, deleteEntity]);

  useEffect(() => {
    const handleFetchEntity = async () => {
      if (!foreignId && !entityId && !shortId) return;

      if (entity && entityId && entity.id === entityId) return;
      if (entity && foreignId && entity.foreignId === foreignId) return;
      if (entity && shortId && entity.shortId === shortId) return;

      // Fold `include` into the cache key so a changed `include` (same id) is a cache miss
      // and re-fetches, rather than serving the previously-fetched entity without it.
      const includeKey = Array.isArray(include) ? include.join(",") : include ?? "";
      const uniqueKey = `${entityId ?? ""}-${foreignId ?? ""}-${shortId ?? ""}-${includeKey}`;

      // If we have a cached entity, update the state and exit.
      if (entityCache.current[uniqueKey]) {
        setEntity(entityCache.current[uniqueKey]);
        return;
      }

      try {
        let fetchedEntity: Entity | null = null;

        if (entityId) {
          fetchedEntity = await fetchEntity({
            entityId,
            include,
          });
        } else if (foreignId) {
          fetchedEntity = await fetchEntityByForeignId({
            foreignId,
            createIfNotFound,
            include,
          });
        } else if (shortId) {
          fetchedEntity = await fetchEntityByShortId({
            shortId,
            include,
          });
        }

        if (fetchedEntity) {
          // Store the fetched entity in cache.
          entityCache.current[uniqueKey] = fetchedEntity;
          setEntity(fetchedEntity);
        } else {
          setEntity(null);
        }
      } catch (err) {
        handleError(err, "Failed to fetch entity");
      }
    };

    handleFetchEntity();
  }, [
    fetchEntity,
    fetchEntityByForeignId,
    fetchEntityByShortId,
    entityId,
    foreignId,
    shortId,
    entity,
    createIfNotFound,
    include,
  ]);

  useEffect(() => {
    if (entityProp) setEntity(entityProp);
  }, [entityProp]);

  return {
    entity,
    setEntity,
    updateEntity: handleUpdateEntity,
    deleteEntity: handleDeleteEntity,
  };
}

export default useEntityData;
