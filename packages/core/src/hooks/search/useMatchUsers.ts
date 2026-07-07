import { useCallback, useState } from "react";
import useProject from "../projects/useProject";
import useAxiosPrivate from "../../config/useAxiosPrivate";
import { handleError } from "../../utils/handleError";
import { User } from "../../interfaces/models/User";

export interface MatchFacetRef {
  id: string;
  hotness: number;
}

export interface SampleContent {
  sourceType: "entity" | "comment" | "message";
  recordId: string;
  content: string;
  similarity: number;
}

export interface MatchedFacet {
  similarity: number;
  askerFacet?: MatchFacetRef;
  candidateFacet: MatchFacetRef;
  sampleContent?: SampleContent[];
}

export interface UserMatchResult {
  user: User;
  score: number;
  matchedFacets: MatchedFacet[];
}

export interface UseMatchUsersProps {
  mode: "passive" | "directed";
  query?: string;
  limit?: number;
  spaceId?: string;
  includeChildSpaces?: boolean;
  includeSampleContent?: boolean;
  excludeSelf?: boolean;
}

export interface UseMatchUsersReturn {
  results: UserMatchResult[];
  loading: boolean;
  error: string | null;
  match: (props: UseMatchUsersProps) => Promise<void>;
  reset: () => void;
}

export default function useMatchUsers(): UseMatchUsersReturn {
  const { projectId } = useProject();
  const axios = useAxiosPrivate();

  const [results, setResults] = useState<UserMatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const match = useCallback(
    async ({
      mode,
      query,
      limit,
      spaceId,
      includeChildSpaces,
      includeSampleContent,
      excludeSelf,
    }: UseMatchUsersProps) => {
      if (!projectId) return;
      if (mode === "directed" && !query?.trim()) return;

      setLoading(true);
      setError(null);
      try {
        const response = await axios.post<{ results: UserMatchResult[] }>(
          `/${projectId}/match/users`,
          {
            mode,
            query,
            limit,
            spaceId,
            includeChildSpaces,
            includeSampleContent,
            excludeSelf,
          }
        );
        setResults(response.data.results);
      } catch (err) {
        setError(handleError(err, "Failed to match users"));
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

  return { results, loading, error, match, reset };
}
