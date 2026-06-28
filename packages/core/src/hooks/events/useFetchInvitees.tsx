import { useCallback } from "react";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import useProject from "../projects/useProject";
import { EventInvite } from "../../interfaces/models/Event";
import { PaginatedResponse } from "../../interfaces/PaginatedResponse";

export interface FetchInviteesProps {
  eventId: string;
  page?: number;
  limit?: number;
}

/** Host-only invitee (guest) list. Non-hosts get 403. */
function useFetchInvitees(): (
  props: FetchInviteesProps
) => Promise<PaginatedResponse<EventInvite>> {
  const axios = useAxiosPrivate();
  const { projectId } = useProject();

  const fetchInvitees = useCallback(
    async ({ eventId, page, limit }: FetchInviteesProps) => {
      if (!projectId) {
        throw new Error("No projectId available.");
      }

      const params: Record<string, any> = {};
      if (page !== undefined) params.page = page;
      if (limit !== undefined) params.limit = limit;

      const response = await axios.get<PaginatedResponse<EventInvite>>(
        `/${projectId}/events/${eventId}/invites`,
        { params }
      );

      return response.data;
    },
    [projectId, axios]
  );

  return fetchInvitees;
}

export default useFetchInvitees;
