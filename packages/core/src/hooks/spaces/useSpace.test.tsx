import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { SpaceContext } from "../../context/space-context";
import useSpace from "./useSpace";

describe("useSpace", () => {
  it("returns an empty object when rendered outside a SpaceProvider (the `if (!context) throw` guard never fires, since the context default is `{}`, not null/undefined)", () => {
    const { result } = renderHook(() => useSpace());
    expect(result.current).toEqual({});
  });

  it("returns the value provided by the nearest SpaceContext", () => {
    const value = { space: undefined, isMember: false };
    const { result } = renderHook(() => useSpace(), {
      wrapper: ({ children }) => (
        <SpaceContext.Provider value={value as any}>{children}</SpaceContext.Provider>
      ),
    });

    expect(result.current).toBe(value);
  });
});
