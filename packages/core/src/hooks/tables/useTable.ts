import { useCallback, useEffect, useMemo } from "react";

import { useReplykeDispatch, useReplykeSelector } from "../../store/hooks";
import useProject from "../projects/useProject";
import type { PaginationMetadata } from "../../interfaces/PaginatedResponse";
import type { DbFilter, TableRow } from "../../interfaces/models/Table";
import {
  initializeTableView,
  selectTableView,
  setTableView,
  type TableViewState,
} from "../../store/slices/tablesSlice";
import {
  useCreateRowMutation,
  useDeleteRowMutation,
  useFetchTableRowsQuery,
  useRestoreRowMutation,
  useUpdateRowMutation,
} from "../../store/api/tablesApi";

export type UseTableOptions = Partial<TableViewState>;

const DEFAULT_VIEW: TableViewState = {
  page: 1,
  limit: 20,
  sortBy: undefined,
  sortDir: undefined,
  filters: [],
  includeDeleted: false,
};

export interface UseTableValues<T extends TableRow = TableRow> {
  rows: T[];
  pagination: PaginationMetadata | null;
  loading: boolean;
  error: unknown;
  refetch: () => void;

  // Query controls (persisted in the tables slice).
  view: TableViewState;
  setView: (view: Partial<TableViewState>) => void;
  setPage: (page: number) => void;
  setFilters: (filters: DbFilter[]) => void;
  setSort: (sortBy: string | undefined, sortDir?: "asc" | "desc") => void;
  setIncludeDeleted: (includeDeleted: boolean) => void;

  // Row mutations (projectId + tableName injected).
  createRow: (data: Record<string, unknown>) => Promise<T>;
  updateRow: (rowId: string, data: Record<string, unknown>) => Promise<T>;
  deleteRow: (
    rowId: string,
    opts?: { force?: boolean },
  ) => Promise<{ deleted: boolean; soft: boolean }>;
  restoreRow: (rowId: string) => Promise<T>;
}

/**
 * React hook for a custom table's rows, backed by RTK Query against the `/db`
 * surface. Returns rows + loading/refetch state plus CRUD actions. The query
 * knobs (page/limit/sort/filters/includeDeleted) live in the `tables` slice so
 * multiple consumers of the same table share one view.
 *
 * Core is hook-only — `@agora-sdk/core` has no imperative client object (React
 * hooks + Redux only), so this hook is the custom-table surface.
 */
export function useTable<T extends TableRow = TableRow>(
  tableName: string,
  options: UseTableOptions = {},
): UseTableValues<T> {
  const dispatch = useReplykeDispatch();
  const { projectId } = useProject();

  const storedView = useReplykeSelector((state) =>
    selectTableView(state, tableName),
  );
  const view: TableViewState = storedView ?? { ...DEFAULT_VIEW, ...options };

  // Seed the slice view once (idempotent — initializeTableView no-ops if set).
  useEffect(() => {
    dispatch(initializeTableView({ tableName, view: options }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName]);

  const { data, isLoading, error, refetch } = useFetchTableRowsQuery(
    {
      projectId: projectId as string,
      tableName,
      page: view.page,
      limit: view.limit,
      sortBy: view.sortBy,
      sortDir: view.sortDir,
      filters: view.filters,
      includeDeleted: view.includeDeleted,
    },
    { skip: !projectId },
  );

  const [createRowMutation] = useCreateRowMutation();
  const [updateRowMutation] = useUpdateRowMutation();
  const [deleteRowMutation] = useDeleteRowMutation();
  const [restoreRowMutation] = useRestoreRowMutation();

  const update = useCallback(
    (next: Partial<TableViewState>) =>
      dispatch(setTableView({ tableName, view: next })),
    [dispatch, tableName],
  );

  const createRow = useCallback(
    async (rowData: Record<string, unknown>) => {
      const res = await createRowMutation({
        projectId: projectId as string,
        tableName,
        data: rowData,
      }).unwrap();
      return res.row as T;
    },
    [createRowMutation, projectId, tableName],
  );

  const updateRow = useCallback(
    async (rowId: string, rowData: Record<string, unknown>) => {
      const res = await updateRowMutation({
        projectId: projectId as string,
        tableName,
        rowId,
        data: rowData,
      }).unwrap();
      return res.row as T;
    },
    [updateRowMutation, projectId, tableName],
  );

  const deleteRow = useCallback(
    async (rowId: string, opts?: { force?: boolean }) =>
      deleteRowMutation({
        projectId: projectId as string,
        tableName,
        rowId,
        force: opts?.force,
      }).unwrap(),
    [deleteRowMutation, projectId, tableName],
  );

  const restoreRow = useCallback(
    async (rowId: string) => {
      const res = await restoreRowMutation({
        projectId: projectId as string,
        tableName,
        rowId,
      }).unwrap();
      return res.row as T;
    },
    [restoreRowMutation, projectId, tableName],
  );

  return useMemo<UseTableValues<T>>(
    () => ({
      rows: (data?.data as T[]) ?? [],
      pagination: data?.pagination ?? null,
      loading: isLoading,
      error,
      refetch,
      view,
      setView: update,
      setPage: (page) => update({ page }),
      setFilters: (filters) => update({ filters, page: 1 }),
      setSort: (sortBy, sortDir) => update({ sortBy, sortDir, page: 1 }),
      setIncludeDeleted: (includeDeleted) => update({ includeDeleted, page: 1 }),
      createRow,
      updateRow,
      deleteRow,
      restoreRow,
    }),
    [
      data,
      isLoading,
      error,
      refetch,
      view,
      update,
      createRow,
      updateRow,
      deleteRow,
      restoreRow,
    ],
  );
}

export default useTable;
