import { describe, it, expect, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";

import { ReplykeProvider, ReplykeContext } from "./replyke-context";
import useProject from "../hooks/projects/useProject";

describe("ReplykeProvider", () => {
  it("throws when projectId is falsy", () => {
    // React + jsdom log the error to console even though it's caught below —
    // silence that expected noise for this one test.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        <ReplykeProvider projectId={"" as never}>
          <div />
        </ReplykeProvider>,
      ),
    ).toThrow("projectId in ReplykeProvider is string");

    consoleSpy.mockRestore();
  });
});

describe("ReplykeContext", () => {
  it("exposes projectId/project to consumers via useProject", () => {
    const project = { id: "project-1", integrations: [] };
    const { result } = renderHook(() => useProject(), {
      wrapper: ({ children }) => (
        <ReplykeContext.Provider value={{ projectId: "project-1", project }}>
          {children}
        </ReplykeContext.Provider>
      ),
    });

    expect(result.current.projectId).toBe("project-1");
    expect(result.current.project).toEqual(project);
  });
});
