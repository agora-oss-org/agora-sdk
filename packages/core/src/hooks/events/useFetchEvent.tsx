import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { Event } from "../../interfaces/models/Event";

export interface FetchEventProps {
  eventId: string;
  /** Associations to expand, e.g. ["user", "space", "files", "userRsvp"]. */
  include?: string | string[];
}

function useFetchEvent(): (props: FetchEventProps) => Promise<Event> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const fetchEvent = useCallback(
    async ({ eventId, include }: FetchEventProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }
      if (!eventId) {
        throw new Error("Please pass an eventId");
      }

      const params: Record<string, any> = {};
      if (include) {
        params.include = Array.isArray(include) ? include.join(",") : include;
      }

      const response = await axios.get(`/${projectId}/events/${eventId}`, {
        params,
      });

      return response.data as Event;
    },
    [projectId, axios]
  );

  return fetchEvent;
}

export default useFetchEvent;
