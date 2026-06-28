import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { Event, RsvpStatus } from "../../interfaces/models/Event";

export interface SetRsvpProps {
  eventId: string;
  status: RsvpStatus;
}

function useSetRsvp(): (props: SetRsvpProps) => Promise<Event> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const setRsvp = useCallback(
    async ({ eventId, status }: SetRsvpProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const response = await axios.post(
        `/${projectId}/events/${eventId}/rsvp`,
        { status }
      );

      return response.data as Event;
    },
    [projectId, axios]
  );

  return setRsvp;
}

export default useSetRsvp;
