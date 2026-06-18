import { useCallback, useState } from "react";
import useProject from "../projects/useProject";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import { handleError } from "../../utils/handleError";
import { Entity } from "../../interfaces/models/Entity";
import { Comment } from "../../interfaces/models/Comment";
import { ChatMessage } from "../../interfaces/models/ChatMessage";

export interface ContentSearchResult {
  sourceType: "entity" | "comment" | "message";
  similarity: number;
  record: Entity | Comment | ChatMessage;
}

export interface UseSearchContentProps {
  query: string;
  sourceTypes?: ("entity" | "comment" | "message")[];
  spaceId?: string;
  conversationId?: string;
  limit?: number;
  /**
   * Opt into per-row `spaceReputation` on embedded users. Accepted forms: a
   * space `<uuid>`, `"none"`, or `"context"`. Sent as a query param (the server
   * reads it from the query string, not the request body).
   */
  spaceReputationId?: string;
  /** Only honored with an explicit `<uuid>` `spaceReputationId`. */
  spaceReputationDescendants?: boolean;
}

export interface UseSearchContentReturn {
  results: ContentSearchResult[];
  loading: boolean;
  error: string | null;
  search: (props: UseSearchContentProps) => Promise<void>;
  reset: () => void;
}

export default function useSearchContent(): UseSearchContentReturn {
  const { projectId } = useProject();
  const axios = useAxiosPrivate();

  const [results, setResults] = useState<ContentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async ({ query, sourceTypes, spaceId, conversationId, limit, spaceReputationId, spaceReputationDescendants }: UseSearchContentProps) => {
      if (!projectId) return;
      if (!query.trim()) return;

      setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = {};
        if (spaceReputationId !== undefined) params.spaceReputationId = spaceReputationId;
        if (spaceReputationDescendants !== undefined) params.spaceReputationDescendants = spaceReputationDescendants;
        const response = await axios.post<ContentSearchResult[]>(
          `/${projectId}/search/content`,
          { query, sourceTypes, spaceId, conversationId, limit },
          { params }
        );
        setResults(response.data);
      } catch (err) {
        setError(handleError(err, "Failed to search content"));
      } finally {
        setLoading(false);
      }
    },
    [projectId, axios]
  );

  const reset = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, loading, error, search, reset };
}
