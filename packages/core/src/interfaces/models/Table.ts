/**
 * Custom-table types for the `/db` surface. Names mirror the server's `/db`
 * read contract exactly (page/limit/sortBy/sortDir/filters/includeDeleted; the
 * 10 filter operators).
 */

export type DbFilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "like"
  | "isNull";

export interface DbFilter {
  column: string;
  operator: DbFilterOperator;
  value?: unknown;
}

export interface TableQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /** AND-combined filter clauses. */
  filters?: DbFilter[];
  /** Surface soft-deleted rows on a paranoid table. */
  includeDeleted?: boolean;
}

/** Shape every custom-table row shares (managed columns + free columns). */
export interface TableRow {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  [column: string]: unknown;
}
