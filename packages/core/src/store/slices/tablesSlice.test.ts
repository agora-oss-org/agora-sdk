import { describe, it, expect } from "vitest";

import reducer, {
  initializeTableView,
  setTableView,
  resetTableView,
  selectTableView,
  type TablesState,
} from "./tablesSlice";

const initial: TablesState = { views: {} };

describe("tablesSlice", () => {
  it("initializes a view with defaults merged over options (once)", () => {
    const s1 = reducer(
      initial,
      initializeTableView({ tableName: "Events", view: { limit: 50 } }),
    );
    expect(s1.views.Events).toEqual({
      page: 1,
      limit: 50,
      sortBy: undefined,
      sortDir: undefined,
      filters: [],
      includeDeleted: false,
    });

    // Idempotent — a second initialize does not overwrite.
    const s2 = reducer(
      s1,
      initializeTableView({ tableName: "Events", view: { limit: 999 } }),
    );
    expect(s2.views.Events.limit).toBe(50);
  });

  it("merges partial updates via setTableView", () => {
    const s1 = reducer(initial, initializeTableView({ tableName: "Events" }));
    const s2 = reducer(
      s1,
      setTableView({ tableName: "Events", view: { page: 3, includeDeleted: true } }),
    );
    expect(s2.views.Events.page).toBe(3);
    expect(s2.views.Events.includeDeleted).toBe(true);
    expect(s2.views.Events.limit).toBe(20); // untouched default
  });

  it("setTableView creates the view if missing", () => {
    const s1 = reducer(
      initial,
      setTableView({ tableName: "New", view: { sortBy: "rank", sortDir: "asc" } }),
    );
    expect(s1.views.New.sortBy).toBe("rank");
    expect(s1.views.New.sortDir).toBe("asc");
    expect(s1.views.New.page).toBe(1);
  });

  it("resetTableView restores defaults", () => {
    let s = reducer(initial, initializeTableView({ tableName: "Events" }));
    s = reducer(s, setTableView({ tableName: "Events", view: { page: 9 } }));
    s = reducer(s, resetTableView("Events"));
    expect(s.views.Events.page).toBe(1);
  });

  it("selectTableView reads the namespaced state", () => {
    const s = reducer(initial, initializeTableView({ tableName: "Events" }));
    const view = selectTableView({ replyke: { tables: s } } as never, "Events");
    expect(view?.page).toBe(1);
    expect(selectTableView({ replyke: { tables: s } } as never, "Missing")).toBeUndefined();
  });
});
