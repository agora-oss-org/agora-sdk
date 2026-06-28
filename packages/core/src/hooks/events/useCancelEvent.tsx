import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { Event } from "../../interfaces/models/Event";

export interface CancelEventProps {
  eventId: string;
}

function useCancelEvent(): (props: CancelEventProps) => Promise<Event> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const cancelEvent = useCallback(
    async ({ eventId }: CancelEventProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }
      if (!eventId) {
        throw new Error("No eventId provided.");
      }

      const response = await axios.post(`/${projectId}/events/${eventId}/cancel`);

      return response.data as Event;
    },
    [projectId, axios]
  );

  return cancelEvent;
}

export default useCancelEvent;
