import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { Event } from "../../interfaces/models/Event";

export interface WithdrawRsvpProps {
  eventId: string;
}

function useWithdrawRsvp(): (props: WithdrawRsvpProps) => Promise<Event> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const withdrawRsvp = useCallback(
    async ({ eventId }: WithdrawRsvpProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const response = await axios.delete(
        `/${projectId}/events/${eventId}/rsvp`
      );

      return response.data as Event;
    },
    [projectId, axios]
  );

  return withdrawRsvp;
}

export default useWithdrawRsvp;
