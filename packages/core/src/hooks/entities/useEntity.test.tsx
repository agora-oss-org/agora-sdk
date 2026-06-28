import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { EntityContext } from "../../context/entity-context";
import useEntity from "./useEntity";

describe("useEntity", () => {
  it("returns an empty object when rendered outside an EntityProvider", () => {
    const { result } = renderHook(() => useEntity());
    expect(result.current).toEqual({});
  });

  it("returns the value provided by the nearest EntityContext", () => {
    const value = { entity: undefined, loading: false };
    const { result } = renderHook(() => useEntity(), {
      wrapper: ({ children }) => (
        <EntityContext.Provider value={value as any}>{children}</EntityContext.Provider>
      ),
    });

    expect(result.current).toBe(value);
  });
});
