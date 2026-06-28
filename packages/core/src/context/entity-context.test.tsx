import React, { useContext } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";

import { resetAxiosMocks, makeEntity } from "../test-utils";
import { makeProvidersWrapper } from "./testHelpers";
import { EntityProvider, EntityContext } from "./entity-context";

afterEach(() => {
  resetAxiosMocks();
});

describe("EntityProvider", () => {
  it("exposes a directly-provided entity via context, with no fetch", () => {
    const entity = makeEntity({ id: "entity-1" });
    const { Wrapper } = makeProvidersWrapper();

    const { result } = renderHook(() => useContext(EntityContext), {
      wrapper: ({ children }) => (
        <Wrapper>
          <EntityProvider entity={entity}>{children}</EntityProvider>
        </Wrapper>
      ),
    });

    expect(result.current.entity).toEqual(entity);
    expect(typeof result.current.updateEntity).toBe("function");
    expect(typeof result.current.deleteEntity).toBe("function");
    expect(typeof result.current.setEntity).toBe("function");
  });

  it("fetches the entity by entityId and exposes the resolved entity via context", async () => {
    const entity = makeEntity({ id: "entity-1" });
    const { Wrapper, axiosPrivate } = makeProvidersWrapper({
      beforeRender: ({ axiosPrivate }) => axiosPrivate.mockResponse("get", entity),
    });

    const { result } = renderHook(() => useContext(EntityContext), {
      wrapper: ({ children }) => (
        <Wrapper>
          <EntityProvider entityId="entity-1">{children}</EntityProvider>
        </Wrapper>
      ),
    });

    await waitFor(() => expect(result.current.entity).toEqual(entity));

    const [call] = axiosPrivate.calls("get");
    expect(call.url).toBe("/test-project/entities/entity-1");
  });

  it("renders nothing when no entity-identifying prop is provided", () => {
    const { Wrapper } = makeProvidersWrapper();

    const NoIdentifyingPropsEntityProvider = EntityProvider as React.FC<{
      children: React.ReactNode;
    }>;
    const { container } = render(
      <Wrapper>
        <NoIdentifyingPropsEntityProvider>
          <div data-testid="child" />
        </NoIdentifyingPropsEntityProvider>
      </Wrapper>,
    );

    expect(container.querySelector('[data-testid="child"]')).toBeNull();
  });

  it("updates the exposed entity when updateEntity is called", async () => {
    const entity = makeEntity({ id: "entity-1", title: "Old title" });
    const { Wrapper, axiosPrivate } = makeProvidersWrapper();

    const { result } = renderHook(() => useContext(EntityContext), {
      wrapper: ({ children }) => (
        <Wrapper>
          <EntityProvider entity={entity}>{children}</EntityProvider>
        </Wrapper>
      ),
    });

    const updated = { ...entity, title: "New title" };
    axiosPrivate.mockResponse("patch", updated);

    await act(async () => {
      await result.current.updateEntity!({ update: { title: "New title" } });
    });

    expect(result.current.entity).toEqual(updated);

    const [call] = axiosPrivate.calls("patch");
    expect(call.url).toBe("/test-project/entities/entity-1");
    expect(call.body).toMatchObject({ title: "New title" });
  });

  it("clears the exposed entity when deleteEntity is called", async () => {
    const entity = makeEntity({ id: "entity-1" });
    const { Wrapper, axiosPrivate } = makeProvidersWrapper();

    const { result } = renderHook(() => useContext(EntityContext), {
      wrapper: ({ children }) => (
        <Wrapper>
          <EntityProvider entity={entity}>{children}</EntityProvider>
        </Wrapper>
      ),
    });

    axiosPrivate.mockResponse("delete", undefined, 204);

    await act(async () => {
      await result.current.deleteEntity!();
    });

    expect(result.current.entity).toBeUndefined();

    const [call] = axiosPrivate.calls("delete");
    expect(call.url).toBe("/test-project/entities/entity-1");
  });
});
