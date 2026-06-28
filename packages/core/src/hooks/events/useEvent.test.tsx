import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { EventContext } from "../../context/event-context";
import useEvent from "./useEvent";

describe("useEvent", () => {
  it("returns an empty object when rendered outside an EventProvider", () => {
    const { result } = renderHook(() => useEvent());
    expect(result.current).toEqual({});
  });

  it("returns the value provided by the nearest EventContext", () => {
    const value = { event: undefined };
    const { result } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => (
        <EventContext.Provider value={value as any}>{children}</EventContext.Provider>
      ),
    });

    expect(result.current).toBe(value);
  });
});
