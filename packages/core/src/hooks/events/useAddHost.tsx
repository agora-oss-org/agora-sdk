import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { Event } from "../../interfaces/models/Event";

export interface AddHostProps {
  eventId: string;
  /** The user to grant host on the event. */
  userId: string;
}

function useAddHost(): (props: AddHostProps) => Promise<Event> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const addHost = useCallback(
    async ({ eventId, userId }: AddHostProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const response = await axios.post(
        `/${projectId}/events/${eventId}/hosts`,
        { userId }
      );

      return response.data as Event;
    },
    [projectId, axios]
  );

  return addHost;
}

export default useAddHost;
