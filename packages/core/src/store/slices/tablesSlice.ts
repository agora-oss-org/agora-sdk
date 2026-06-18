import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { ReplykeState } from "../replykeReducers";
import type { DbFilter } from "../../interfaces/models/Table";

/**
 * Per-table view state (pagination / sort / filters / includeDeleted) backing
 * the `useTable` hook. Mirrors `entityListsSlice` in spirit — the slice holds
 * the query knobs, the RTK Query `tablesApi` holds the row data + cache.
 */
export interface TableViewState {
  page: number;
  limit: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  filters: DbFilter[];
  includeDeleted: boolean;
}

export interface TablesState {
  views: { [tableName: string]: TableViewState };
}

const createDefaultView = (): TableViewState => ({
  page: 1,
  limit: 20,
  sortBy: undefined,
  sortDir: undefined,
  filters: [],
  includeDeleted: false,
});

const initialState: TablesState = { views: {} };

export interface SetTableViewPayload {
  tableName: string;
  view: Partial<TableViewState>;
}

export const tablesSlice = createSlice({
  name: "tables",
  initialState,
  reducers: {
    initializeTableView: (
      state,
      action: PayloadAction<{ tableName: string; view?: Partial<TableViewState> }>,
    ) => {
      const { tableName, view } = action.payload;
      if (!state.views[tableName]) {
        state.views[tableName] = { ...createDefaultView(), ...view };
      }
    },

    setTableView: (state, action: PayloadAction<SetTableViewPayload>) => {
      const { tableName, view } = action.payload;
      const current = state.views[tableName] ?? createDefaultView();
      state.views[tableName] = { ...current, ...view };
    },

    resetTableView: (state, action: PayloadAction<string>) => {
      state.views[action.payload] = createDefaultView();
    },
  },
});

export const { initializeTableView, setTableView, resetTableView } =
  tablesSlice.actions;

const selectTablesState = (state: { replyke: ReplykeState }) =>
  state.replyke.tables;
const selectTableName = (_: { replyke: ReplykeState }, tableName: string) =>
  tableName;

export const selectTableView = createSelector(
  [selectTablesState, selectTableName],
  (tablesState, tableName): TableViewState | undefined =>
    tablesState.views[tableName],
);

export default tablesSlice.reducer;
