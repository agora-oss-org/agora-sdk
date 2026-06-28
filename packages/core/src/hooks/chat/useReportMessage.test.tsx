import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useReportMessage from "./useReportMessage";

afterEach(() => {
  resetAxiosMocks();
});

describe("useReportMessage", () => {
  it("posts a report with the reason and details", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useReportMessage());

    axiosPrivate.mockResponse("post", {});

    await act(async () => {
      await result.current({
        conversationId: "conversation-1",
        messageId: "message-1",
        reason: "spam",
        details: "posted the same link repeatedly",
      });
    });

    const [call] = axiosPrivate.calls("post");
    expect(call.url).toBe(
      "/test-project/chat/conversations/conversation-1/messages/message-1/report",
    );
    expect(call.body).toEqual({
      reason: "spam",
      details: "posted the same link repeatedly",
    });
  });

  it("rejects and rethrows when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useReportMessage());

    axiosPrivate.mockError("post", 500, { message: "Internal error" });

    await expect(
      result.current({ conversationId: "conversation-1", messageId: "message-1" }),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws before making a request when there is no projectId", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useReportMessage(), {
      projectId: "",
    });

    await expect(
      result.current({ conversationId: "conversation-1", messageId: "message-1" }),
    ).rejects.toThrow("No projectId available.");
    expect(axiosPrivate.calls("post")).toHaveLength(0);
  });
});
