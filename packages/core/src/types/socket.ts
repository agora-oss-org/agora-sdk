import type { ChatMessage } from "../interfaces/models/ChatMessage";
import type { Conversation } from "../interfaces/models/Conversation";
import type { ConversationMember } from "../interfaces/models/ConversationMember";

// ─── Server → Client events ────────────────────────────────────────────────

export interface ServerToClientEvents {
  "message:created": (message: ChatMessage) => void;
  "message:updated": (payload: {
    messageId: string;
    conversationId: string;
    content: string | null;
    gif: ChatMessage["gif"];
    mentions: ChatMessage["mentions"];
    metadata: Record<string, any>;
    editedAt: string | null;
  }) => void;
  "message:deleted": (payload: {
    messageId: string;
    conversationId: string;
    userDeletedAt: string;
  }) => void;
  "message:removed": (payload: {
    messageId: string;
    conversationId: string;
  }) => void;
  "message:reaction": (payload: {
    messageId: string;
    conversationId: string;
    emoji: string;
    userId: string;
    delta: 1 | -1;
    reactionCounts: Record<string, number>;
  }) => void;
  "thread:reply_count": (payload: {
    messageId: string;
    conversationId: string;
    threadReplyCount: number;
  }) => void;
  "typing:start": (payload: {
    userId: string;
    conversationId: string;
  }) => void;
  "typing:stop": (payload: {
    userId: string;
    conversationId: string;
  }) => void;
  "member:joined": (payload: {
    conversationId: string;
    member: ConversationMember;
  }) => void;
  "member:left": (payload: {
    conversationId: string;
    userId: string;
  }) => void;
  "conversation:updated": (patch: Partial<Conversation> & { id: string }) => void;
  "conversation:deleted": (payload: { conversationId: string }) => void;
}

// ─── Client → Server events ────────────────────────────────────────────────

export interface ClientToServerEvents {
  "join:conversation": (payload: { conversationId: string }) => void;
  "leave:conversation": (payload: { conversationId: string }) => void;
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
}
