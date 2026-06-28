import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { mockAxiosPublic, resetAxiosMocks } from "../../test-utils";
import useProjectData from "./useProjectData";
import type { Project } from "../../interfaces/models/Project";

afterEach(() => {
  resetAxiosMocks();
});

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-project",
    clientId: "client-1",
    name: "Test Project",
    integrations: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useProjectData", () => {
  it("fetches the lean project record on mount and exposes it alongside projectId", async () => {
    const axiosPublic = mockAxiosPublic();
    const project = makeProject();
    axiosPublic.mockResponse("get", project);

    const { result } = renderHook(() => useProjectData({ projectId: "test-project" }));

    expect(result.current.projectId).toBe("test-project");

    await waitFor(() => expect(result.current.project).toEqual(project));

    const [call] = axiosPublic.calls("get");
    expect(call.url).toBe("/test-project/projects/lean");
  });

  it("refetches when projectId changes", async () => {
    const axiosPublic = mockAxiosPublic();
    const projectA = makeProject({ id: "project-a", name: "A" });
    axiosPublic.mockResponse("get", projectA);

    const { result, rerender } = renderHook(
      ({ projectId }) => useProjectData({ projectId }),
      { initialProps: { projectId: "project-a" } },
    );

    await waitFor(() => expect(result.current.project).toEqual(projectA));

    const projectB = makeProject({ id: "project-b", name: "B" });
    axiosPublic.mockResponse("get", projectB);
    rerender({ projectId: "project-b" });

    await waitFor(() => expect(result.current.project).toEqual(projectB));
    expect(axiosPublic.calls("get")).toHaveLength(2);
  });

  it("leaves project null without throwing when the fetch fails", async () => {
    const axiosPublic = mockAxiosPublic();
    axiosPublic.mockError("get", 500, { message: "Internal error" });

    const { result } = renderHook(() => useProjectData({ projectId: "test-project" }));

    await waitFor(() => expect(result.current.project).toBeNull());
  });

  it("throws synchronously when no projectId is passed", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      renderHook(() => useProjectData({ projectId: "" })),
    ).toThrow("Please pass a project ID");

    consoleSpy.mockRestore();
  });
});
