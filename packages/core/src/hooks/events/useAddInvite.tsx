import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { Event } from "../../interfaces/models/Event";

export interface AddInviteProps {
  eventId: string;
  /** The user to invite (userId only — never a foreignId). Idempotent. */
  userId: string;
}

function useAddInvite(): (props: AddInviteProps) => Promise<Event> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const addInvite = useCallback(
    async ({ eventId, userId }: AddInviteProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const response = await axios.post(
        `/${projectId}/events/${eventId}/invites`,
        { userId }
      );

      return response.data as Event;
    },
    [projectId, axios]
  );

  return addInvite;
}

export default useAddInvite;
