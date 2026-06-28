import { describe, it, expect } from "vitest";

import { renderWithChatContext, makeFakeSocket } from "./testHelpers";
import useChatSocket from "./useChatSocket";

describe("useChatSocket", () => {
  it("returns null/disconnected defaults outside a ChatProvider", () => {
    const { result } = renderWithChatContext(() => useChatSocket());

    expect(result.current.socket).toBeNull();
    expect(result.current.connected).toBe(false);
  });

  it("returns the socket and connected state provided by ChatContext", () => {
    const socket = makeFakeSocket();
    const { result } = renderWithChatContext(() => useChatSocket(), {
      chatContextValue: { socket: socket as any, connected: true },
    });

    expect(result.current.socket).toBe(socket);
    expect(result.current.connected).toBe(true);
  });
});
