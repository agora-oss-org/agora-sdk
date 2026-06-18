// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — `lastMessageAt` retyped from `Date | null` to
// `string | null` (ISO over the wire, patched from a ChatMessage's string `createdAt`), keeping the
// conversation-list store serializable (RTK serializableCheck). Sorted via `new Date(...)`.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import { File } from "./File";
import { ChatMessage } from "./ChatMessage";
import { ConversationMember } from "./ConversationMember";

export interface Conversation {
  id: string;
  projectId: string;
  type: "direct" | "group" | "space";
  name: string | null;
  description: string | null;
  spaceId: string | null;
  createdById: string | null;
  avatarFileId: string | null;
  // ISO string over the wire, and patched from a ChatMessage's (string) createdAt on new messages.
  // Sorted via `new Date(lastMessageAt)` in the chat slice. Typed `string` (not `Date`) to match the
  // wire shape and keep the conversation-list store serializable (RTK serializableCheck).
  lastMessageAt: string | null;
  // Null for DMs and groups; 'members' | 'admins' for space chats
  postingPermission: "members" | "admins" | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  // Populated fields
  memberCount?: number;
  // The requesting user's own ConversationMember row — used to bootstrap lastReadAt and role
  currentMember?: ConversationMember;
  avatarFile?: File;
}

export interface ConversationPreview extends Conversation {
  unreadCount: number;
  // Truncated to 100 chars by the server for list performance
  lastMessage: ChatMessage | null;
}
