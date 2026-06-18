import { useCallback } from "react";
import useProject from "../projects/useProject";
import { Comment, CommentIncludeParam } from "../../interfaces/models/Comment";
import axios from "../../config/axios";

export interface FetchCommentProps {
  commentId: string;
  include?: CommentIncludeParam;
  /**
   * Opt into per-row `spaceReputation` on embedded users. Accepted forms: a
   * space `<uuid>`, `"none"`, or `"context"`.
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

function useFetchComment(): (props: FetchCommentProps) => Promise<{ comment: Comment }> {
  const { projectId } = useProject();

  const fetchComment = useCallback(
    async ({ commentId, include, spaceReputationId, spaceReputationDescendants }: FetchCommentProps) => {
      if (!projectId) {
        throw new Error("No project specified");
      }

      if (!commentId) {
        throw new Error("No comment ID passed");
      }

      const params: Record<string, any> = {};

      if (include) {
        params.include = Array.isArray(include) ? include.join(',') : include;
      }
      if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
      if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;

      const response = await axios.get(`/${projectId}/comments/${commentId}`, {
        params,
      });

      return response.data as {
        comment: Comment;
      };
    },
    [projectId]
  );

  return fetchComment;
}

export default useFetchComment;
