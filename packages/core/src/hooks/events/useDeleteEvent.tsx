import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";

export interface DeleteEventProps {
  eventId: string;
}

function useDeleteEvent(): (props: DeleteEventProps) => Promise<void> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const deleteEvent = useCallback(
    async ({ eventId }: DeleteEventProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }
      if (!eventId) {
        throw new Error("No eventId provided.");
      }

      await axios.delete(`/${projectId}/events/${eventId}`);
    },
    [projectId, axios]
  );

  return deleteEvent;
}

export default useDeleteEvent;
