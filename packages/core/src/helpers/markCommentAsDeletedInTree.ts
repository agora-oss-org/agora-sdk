import { EntityCommentsTree } from "../interfaces/EntityCommentsTree";

/**
 * Reddit-style deletion: instead of removing the comment from the tree,
 * mark it as user-deleted by clearing content fields and setting userDeletedAt.
 * The comment remains visible as a placeholder so children stay intact.
 */
export function markCommentAsDeletedInTree(
  state: EntityCommentsTree,
  commentId: string
): EntityCommentsTree {
  const entry = state[commentId];
  if (!entry) return state;

  return {
    ...state,
    [commentId]: {
      ...entry,
      comment: {
        ...entry.comment,
        userDeletedAt: new Date().toISOString(),
        content: null,
        gif: null,
        mentions: [],
        userId: null as unknown as string,
        user: undefined,
      },
    },
  };
}
