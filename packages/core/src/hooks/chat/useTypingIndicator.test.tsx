import { describe, it, expect, vi } from "vitest";
import { act } from "@testing-library/react";

import { renderWithChatContext, makeFakeSocket } from "./testHelpers";
import useTypingIndicator from "./useTypingIndicator";

describe("useTypingIndicator", () => {
  it("emits typing:start once and sets up a keep-alive interval", () => {
    vi.useFakeTimers();
    const socket = makeFakeSocket();

    const { result } = renderWithChatContext(
      () => useTypingIndicator({ conversationId: "conversation-1" }),
      { chatContextValue: { socket: socket as any } },
    );

    act(() => {
      result.current.startTyping();
    });
    expect(socket.emit).toHaveBeenCalledWith("typing:start", { conversationId: "conversation-1" });
    expect(socket.emit).toHaveBeenCalledTimes(1);

    // A second call while already typing doesn't re-emit immediately.
    act(() => {
      result.current.startTyping();
    });
    expect(socket.emit).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(socket.emit).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("emits typing:stop and clears the keep-alive", () => {
    vi.useFakeTimers();
    const socket = makeFakeSocket();

    const { result } = renderWithChatContext(
      () => useTypingIndicator({ conversationId: "conversation-1" }),
      { chatContextValue: { socket: socket as any } },
    );

    act(() => {
      result.current.startTyping();
    });
    act(() => {
      result.current.stopTyping();
    });

    expect(socket.emit).toHaveBeenCalledWith("typing:stop", { conversationId: "conversation-1" });

    // No further keep-alive emissions after stopping.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(socket.emit).toHaveBeenCalledTimes(2); // start + stop only

    vi.useRealTimers();
  });

  it("does nothing when there is no socket", () => {
    const { result } = renderWithChatContext(() =>
      useTypingIndicator({ conversationId: "conversation-1" }),
    );

    expect(() => result.current.startTyping()).not.toThrow();
    expect(() => result.current.stopTyping()).not.toThrow();
  });

  it("exposes the typingUsers list from the chat slice", () => {
    const { result } = renderWithChatContext(() =>
      useTypingIndicator({ conversationId: "conversation-1" }),
    );

    expect(result.current.typingUsers).toEqual([]);
  });
});
