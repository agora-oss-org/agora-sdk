import { useCallback } from "react";
import { ChatMessage } from "../../../interfaces/models/ChatMessage";
import useAxiosPrivate from "../../../config/useAxiosPrivate";
import useProject from "../../projects/useProject";
import { SpaceReputationContextParams } from "../../../interfaces/SpaceReputation";
import { buildSpaceReputationParams } from "../../../utils/spaceReputationParams";

export interface MessageFilters {
  /**
   * Filter to messages that have thread replies (not quotings). `true` returns
   * only messages with at least one thread reply; `false` returns only messages
   * with none. Omit for no reply-count filtering.
   */
  hasReplies?: boolean;
}

export interface FetchManyChatMessagesProps extends SpaceReputationContextParams {
  conversationId: string;
  /** Restrict to replies of this message (thread view). */
  parentId?: string | null;
  /** Keyset cursor (ISO timestamp): messages created before this. Mutually exclusive with `after`. */
  before?: string | null;
  /** Keyset cursor (ISO timestamp): messages created after this. Mutually exclusive with `before`. */
  after?: string | null;
  /** Page size (1–100, defaults to 50 server-side). */
  limit?: number;
  sort?: "asc" | "desc";
  /** When `true`, the server populates the `files` field on each message. */
  includeFiles?: boolean;
  filters?: MessageFilters;
}

export interface FetchManyChatMessagesResponse {
  messages: ChatMessage[];
  hasMore: boolean;
  oldestCreatedAt: string | null;
  newestCreatedAt: string | null;
  /**
   * Present only when a filter combination can't return results — e.g.
   * `hasReplies: true` together with `parentId` (thread replies are one level
   * deep and never have their own replies).
   */
  notice?: string;
}

/**
 * Low-level, stateless fetcher for conversation messages. Returns a promise of
 * a single page — no Redux, no socket subscription. This is the single owner of
 * the messages endpoint URL and its query params; both the live store hook
 * (`useLiveChatMessages`) and the query hook (`useFetchManyChatMessagesWrapper`)
 * build on it.
 */
function useFetchManyChatMessages(): (
  props: FetchManyChatMessagesProps
) => Promise<FetchManyChatMessagesResponse> {
  const { projectId } = useProject();
  const axios = useAxiosPrivate();

  return useCallback(
    async (props: FetchManyChatMessagesProps) => {
      const {
        conversationId,
        parentId,
        before,
        after,
        limit = 50,
        sort,
        includeFiles,
        filters,
        spaceReputation,
        spaceReputationId,
        spaceReputationDescendants,
      } = props;

      if (!projectId) throw new Error("No project specified");
      if (!conversationId) throw new Error("No conversation specified");

      const params: Record<string, any> = {
        limit,
        ...buildSpaceReputationParams({
          spaceReputation,
          spaceReputationId,
          spaceReputationDescendants,
        }),
      };
      if (sort) params.sort = sort;
      if (parentId) params.parentId = parentId;
      if (before) params.before = before;
      if (after) params.after = after;
      if (includeFiles) params.include = "files";
      if (filters) params.filters = filters;

      const response = await axios.get<FetchManyChatMessagesResponse>(
        `/${projectId}/chat/conversations/${conversationId}/messages`,
        { params }
      );
      return response.data;
    },
    [projectId, axios]
  );
}

export default useFetchManyChatMessages;
