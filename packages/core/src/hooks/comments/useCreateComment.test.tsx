import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import {
  renderHookWithAxios,
  resetAxiosMocks,
  makeAuthUser,
} from "../../test-utils";
import useCreateComment from "./useCreateComment";
import type { Comment } from "../../interfaces/models/Comment";

afterEach(() => {
  resetAxiosMocks();
});

describe("useCreateComment", () => {
  it("posts the comment and returns the created comment", async () => {
    const user = makeAuthUser({ id: "user-1" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useCreateComment(), {
      projectId: "project-1",
      user,
    });

    const created: Partial<Comment> = { id: "comment-1", content: "hello" };
    axiosPrivate.mockResponse("post", created, 201);

    let returned: Comment | undefined;
    await act(async () => {
      returned = await result.current({
        entityId: "entity-1",
        content: "hello",
      });
    });

    expect(returned).toEqual(created);

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe("/project-1/comments");
    expect(call.body).toMatchObject({ entityId: "entity-1", content: "hello" });
  });

  it("rejects when the server returns an error response", async () => {
    const user = makeAuthUser({ id: "user-1" });
    const { result, axiosPrivate } = renderHookWithAxios(() => useCreateComment(), {
      projectId: "project-1",
      user,
    });

    axiosPrivate.mockError("post", 500, { message: "Internal error" });

    await expect(
      result.current({ entityId: "entity-1", content: "hello" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when there is no authenticated user", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useCreateComment(), {
      projectId: "project-1",
      user: null,
    });

    await expect(
      result.current({ entityId: "entity-1", content: "hello" }),
    ).rejects.toThrow("No authenticated user");

    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });
});
