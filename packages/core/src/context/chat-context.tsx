import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { useReplykeDispatch, useReplykeSelector } from "../store/hooks";
import { selectAccessToken } from "../store/slices/authSlice";
import { selectUser } from "../store/slices/userSlice";
import { selectUser as selectAuthUser } from "../store/slices/authSlice";
import useProject from "../hooks/projects/useProject";
import { BASE_URL } from "../config/axios";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/socket";
import {
  upsertMessage,
  upsertConversationPreview,
  incrementUnread,
  setSocketConnected,
  setTypingUsers,
  updateReactions,
  setConversation,
  setUnreadSummary,
} from "../store/slices/chatSlice";
import useAxiosPrivate from "../config/useAxiosPrivate";
import type { ChatMessage } from "../interfaces/models/ChatMessage";
import type { Conversation } from "../interfaces/models/Conversation";

// ─── Context shape ────────────────────────────────────────────────────────────

export interface ChatContextValue {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
  /** Called by ConversationProvider on mount to suppress unread increments */
  registerActiveConversation: (id: string) => void;
  /** Called by ConversationProvider on unmount */
  unregisterActiveConversation: (id: string) => void;
}

export const ChatContext = createContext<ChatContextValue>({
  socket: null,
  connected: false,
  registerActiveConversation: () => {},
  unregisterActiveConversation: () => {},
});

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useChatContext(): ChatContextValue {
  return useContext(ChatContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export interface ChatProviderProps {
  children: ReactNode;
}

/** Derive the socket.io server URL from the REST API base URL. */
function getSocketUrl(): string {
  // socket.io mounts at the origin; strip the path from BASE_URL
  try {
    return new URL(BASE_URL).origin;
  } catch {
    return "http://localhost:4000";
  }
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const dispatch = useReplykeDispatch();
  const { projectId } = useProject();
  const axiosPrivate = useAxiosPrivate();

  const accessToken = useReplykeSelector(selectAccessToken);
  const user = useReplykeSelector(selectUser);
  const authUser = useReplykeSelector(selectAuthUser);
  const currentUser = user || authUser;

  // Keep mutable refs for values the socket handlers need without closing over stale state
  const currentUserIdRef = useRef<string | null>(currentUser?.id ?? null);
  useEffect(() => {
    currentUserIdRef.current = currentUser?.id ?? null;
  }, [currentUser]);

  // Fresh snapshot of messages for socket handlers that need to find a message by id
  const messagesRef = useRef<Record<string, { items: ChatMessage[] }>>({});
  const allMessages = useReplykeSelector((state: any) => state.replyke.chat.messages as Record<string, { items: ChatMessage[] }>);
  useEffect(() => {
    messagesRef.current = allMessages;
  }, [allMessages]);

  // Fresh snapshot of conversations for conversation:updated merging
  const conversationsRef = useRef<Record<string, { data: Conversation | null }>>({});
  const allConversations = useReplykeSelector((state: any) => state.replyke.chat.conversations as Record<string, { data: Conversation | null }>);
  useEffect(() => {
    conversationsRef.current = allConversations;
  }, [allConversations]);

  // Socket state (tracked in React state so context consumers re-render when it changes)
  const [socketState, setSocketState] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);

  // Mutable refs that don't need to trigger re-renders
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const prevTokenRef = useRef<string | null>(null);

  // Set of conversationIds currently open — prevents unread bumps for active views
  const activeConversationIds = useRef<Set<string>>(new Set());

  // Typing timers per conversation: conversationId → Map<userId, timer>
  const typingTimers = useRef<Map<string, Map<string, ReturnType<typeof setTimeout>>>>(new Map());

  const registerActiveConversation = useCallback((id: string) => {
    activeConversationIds.current.add(id);
  }, []);

  const unregisterActiveConversation = useCallback((id: string) => {
    activeConversationIds.current.delete(id);
  }, []);

  // Helper: cancel a pending typing-timeout for a user in a conversation
  const clearTypingTimer = useCallback((conversationId: string, userId: string) => {
    const convMap = typingTimers.current.get(conversationId);
    if (!convMap) return;
    const timer = convMap.get(userId);
    if (timer !== undefined) {
      clearTimeout(timer);
      convMap.delete(userId);
    }
  }, []);

  // Helper: find a message by id across all loaded conversation buckets
  const findMessage = useCallback((messageId: string): ChatMessage | null => {
    for (const bucket of Object.values(messagesRef.current)) {
      const found = bucket.items?.find((m) => m.id === messageId);
      if (found) return found;
    }
    return null;
  }, []);

  // Helper: remove a userId from the Redux typing list for a conversation
  const removeTypingUser = useCallback(
    (conversationId: string, userId: string) => {
      // We can't use the selector inside a callback without re-reading,
      // so we derive the current array from the state ref we keep in messagesRef.
      // Actually for typing we need the current typingUsers — but that's a separate ref.
      // Simplest: dispatch with the current stored typing users derived from our own
      // typing timer map (we know who is in the map = who is typing).
      const convMap = typingTimers.current.get(conversationId);
      const typingUserIds = convMap ? Array.from(convMap.keys()) : [];
      dispatch(
        setTypingUsers({
          conversationId,
          userIds: typingUserIds.filter((id) => id !== userId),
        })
      );
    },
    [dispatch]
  );

  // ── Unread summary fetch ─────────────────────────────────────────────────────
  // Fetch total unread counts once auth is ready so global badges (e.g. sidebar)
  // are accurate before the user ever loads the conversation list.
  useEffect(() => {
    if (!projectId || !accessToken) return;

    axiosPrivate
      .get<{ totalUnread: number; unreadConversationCount: number }>(
        `/${projectId}/chat/conversations/unread-count`
      )
      .then(({ data }) => {
        dispatch(
          setUnreadSummary({
            totalUnread: data.totalUnread,
            unreadConversationCount: data.unreadConversationCount,
          })
        );
      })
      .catch(() => {
        // Non-critical — badge will update via socket events as messages arrive
      });
    // Re-fetch when auth changes (e.g. user switches accounts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, accessToken]);

  // ── Main socket creation effect ─────────────────────────────────────────────
  const hasToken = Boolean(accessToken);

  useEffect(() => {
    if (!projectId || !accessToken) return;

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      auth: { token: accessToken },
      query: { projectId },
      autoConnect: true,
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;

    socketRef.current = socket;
    setSocketState(socket);
    prevTokenRef.current = accessToken;

    // ── Connection state ────────────────────────────────────────────────────
    socket.on("connect", () => {
      setConnected(true);
      dispatch(setSocketConnected(true));
    });

    socket.on("disconnect", () => {
      setConnected(false);
      dispatch(setSocketConnected(false));
    });

    // ── message:created ─────────────────────────────────────────────────────
    socket.on("message:created", (message) => {
      dispatch(upsertMessage(message));
      dispatch(
        upsertConversationPreview({
          conversationId: message.conversationId,
          patch: {
            lastMessageAt: message.createdAt,
            lastMessage: message,
          },
        })
      );
      if (!activeConversationIds.current.has(message.conversationId)) {
        dispatch(incrementUnread(message.conversationId));
      }
    });

    // ── message:updated ─────────────────────────────────────────────────────
    socket.on("message:updated", (payload) => {
      const existing = findMessage(payload.messageId);
      if (existing) {
        dispatch(
          upsertMessage({
            ...existing,
            content: payload.content,
            gif: payload.gif,
            mentions: payload.mentions,
            metadata: payload.metadata,
            editedAt: payload.editedAt,
          })
        );
      }
    });

    // ── message:deleted ─────────────────────────────────────────────────────
    socket.on("message:deleted", (payload) => {
      const existing = findMessage(payload.messageId);
      if (existing) {
        dispatch(
          upsertMessage({
            ...existing,
            userDeletedAt: payload.userDeletedAt,
            content: null,
            gif: null,
            mentions: [],
            metadata: {},
            files: undefined,
          })
        );
      }
    });

    // ── message:removed ─────────────────────────────────────────────────────
    socket.on("message:removed", (payload) => {
      const existing = findMessage(payload.messageId);
      if (existing) {
        dispatch(
          upsertMessage({
            ...existing,
            moderationStatus: "removed" as const,
          })
        );
      }
    });

    // ── message:reaction ────────────────────────────────────────────────────
    socket.on("message:reaction", (payload) => {
      dispatch(
        updateReactions({
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          reactionCounts: payload.reactionCounts,
          userId: payload.userId,
          emoji: payload.emoji,
          delta: payload.delta,
          currentUserId: currentUserIdRef.current ?? "",
        })
      );
    });

    // ── thread:reply_count ──────────────────────────────────────────────────
    socket.on("thread:reply_count", (payload) => {
      const existing = findMessage(payload.messageId);
      if (existing) {
        dispatch(
          upsertMessage({
            ...existing,
            threadReplyCount: payload.threadReplyCount,
          })
        );
      }
    });

    // ── typing:start ────────────────────────────────────────────────────────
    socket.on("typing:start", ({ userId, conversationId }) => {
      // Ignore self-loop (multiple tabs)
      if (userId === currentUserIdRef.current) return;

      // Reset the 5-second auto-timeout for this user
      clearTypingTimer(conversationId, userId);
      if (!typingTimers.current.has(conversationId)) {
        typingTimers.current.set(conversationId, new Map());
      }
      const convMap = typingTimers.current.get(conversationId)!;

      // Add to Redux typing list if not already present
      const currentTyping = Array.from(convMap.keys());
      if (!currentTyping.includes(userId)) {
        dispatch(
          setTypingUsers({
            conversationId,
            userIds: [...currentTyping, userId],
          })
        );
      }

      // Set timeout to auto-remove after 5 seconds without a keep-alive
      const timer = setTimeout(() => {
        removeTypingUser(conversationId, userId);
        typingTimers.current.get(conversationId)?.delete(userId);
      }, 5000);
      convMap.set(userId, timer);
    });

    // ── typing:stop ─────────────────────────────────────────────────────────
    socket.on("typing:stop", ({ userId, conversationId }) => {
      clearTypingTimer(conversationId, userId);
      removeTypingUser(conversationId, userId);
    });

    // ── conversation:updated ────────────────────────────────────────────────
    socket.on("conversation:updated", (patch) => {
      const existing = conversationsRef.current[patch.id]?.data;
      if (existing) {
        dispatch(setConversation({ ...existing, ...patch }));
      }
    });

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
      setConnected(false);
      dispatch(setSocketConnected(false));

      // Clear all pending typing timers
      Array.from(typingTimers.current.values()).forEach((convMap) => {
        Array.from(convMap.values()).forEach((timer) => {
          clearTimeout(timer);
        });
      });
      typingTimers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, hasToken]);

  // ── Token refresh effect ────────────────────────────────────────────────────
  // When the access token rotates (same socket, new credentials), update socket.auth
  // and force a fresh handshake. Must NOT re-create the socket — that would clear all
  // room memberships. Instead: update auth object, then disconnect().connect().
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !accessToken) return;
    if (prevTokenRef.current === accessToken) return;

    prevTokenRef.current = accessToken;
    // socket.auth must be updated BEFORE disconnect().connect() —
    // Socket.io auto-reconnect reuses the original auth object.
    (socket as any).auth = { token: accessToken };
    socket.disconnect().connect();
  }, [accessToken]);

  return (
    <ChatContext.Provider
      value={{
        socket: socketState,
        connected,
        registerActiveConversation,
        unregisterActiveConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
