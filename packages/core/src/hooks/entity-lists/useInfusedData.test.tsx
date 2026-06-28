import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";

import useInfusedData from "./useInfusedData";
import type { Entity } from "../../interfaces/models/Entity";

const makeEntity = (id: string, foreignId: string | null = id): Entity =>
  ({ id, foreignId } as Entity);

afterEach(() => {
  cleanup();
});

describe("useInfusedData", () => {
  it("returns entities as-is (empty infusion) when no infuseData fn is provided", () => {
    const { result } = renderHook(() =>
      useInfusedData({ entities: [makeEntity("e1")] }),
    );
    // No infuseData => infuseEntities short-circuits, so state never updates from [].
    expect(result.current).toEqual([]);
  });

  it("infuses each entity with the data returned by infuseData, caching by foreignId", async () => {
    const infuseData = vi.fn(async (foreignId: string) => ({ extra: `details-for-${foreignId}` }));
    const { result } = renderHook(() =>
      useInfusedData({ entities: [makeEntity("e1"), makeEntity("e2")], infuseData }),
    );

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current[0].infusion).toEqual({ extra: "details-for-e1" });
    expect(result.current[1].infusion).toEqual({ extra: "details-for-e2" });
    expect(infuseData).toHaveBeenCalledTimes(2);
  });

  it("gives an empty infusion for entities with no foreignId, without calling infuseData", async () => {
    const infuseData = vi.fn(async () => ({ extra: "x" }));
    const { result } = renderHook(() =>
      useInfusedData({ entities: [makeEntity("e1", null)], infuseData }),
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].infusion).toEqual({});
    expect(infuseData).not.toHaveBeenCalled();
  });

  it("gives an empty infusion when infuseData resolves null", async () => {
    const infuseData = vi.fn(async () => null);
    const { result } = renderHook(() =>
      useInfusedData({ entities: [makeEntity("e1")], infuseData }),
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].infusion).toEqual({});
  });

  it("re-uses the cache for a foreignId already infused, without calling infuseData again", async () => {
    const infuseData = vi.fn(async (foreignId: string) => ({ extra: foreignId }));
    const { result, rerender } = renderHook(
      ({ entities }) => useInfusedData({ entities, infuseData }),
      { initialProps: { entities: [makeEntity("e1")] } },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(infuseData).toHaveBeenCalledTimes(1);

    rerender({ entities: [makeEntity("e1"), makeEntity("e2")] });
    await waitFor(() => expect(result.current).toHaveLength(2));
    // e1 came from cache; only e2 triggered a new call.
    expect(infuseData).toHaveBeenCalledTimes(2);
  });

  it("does not re-infuse when the entities array is referentially different but deep-equal", async () => {
    const infuseData = vi.fn(async () => ({ extra: "x" }));
    const { result, rerender } = renderHook(
      ({ entities }) => useInfusedData({ entities, infuseData }),
      { initialProps: { entities: [makeEntity("e1")] } },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(infuseData).toHaveBeenCalledTimes(1);

    rerender({ entities: [makeEntity("e1")] }); // new array, deep-equal contents
    await new Promise((r) => setTimeout(r, 10));
    expect(infuseData).toHaveBeenCalledTimes(1);
  });

  it("swallows a thrown error from infuseData without crashing", async () => {
    const infuseData = vi.fn(async () => {
      throw new Error("network down");
    });
    const { result } = renderHook(() =>
      useInfusedData({ entities: [makeEntity("e1")], infuseData }),
    );

    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toEqual([]);
  });
});
