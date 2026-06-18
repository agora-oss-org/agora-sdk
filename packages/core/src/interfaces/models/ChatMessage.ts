// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — `createdAt`/`updatedAt` retyped from `Date` to
// `string`. The server sends these as ISO strings over JSON and the optimistic-send path mirrors
// that; typing them `string` keeps values in the Redux chat store serializable (RTK
// serializableCheck). Consumers wrap in `new Date(...)` at the point of use.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
import { GifData } from "./Comment";
import { File } from "./File";
import { Mention } from "./Mention";
import { User } from "./User";

export interface ChatMessage {
  id: string;
  // Locally-generated UUID echoed by the server in the REST response and socket payload.
  // Never stored in the DB. Used for optimistic deduplication (matching temp entries to confirmed ones).
  localId?: string;
  projectId: string;
  conversationId: string;
  // null when the original sender's account has been deleted (FK SET NULL)
  userId: string | null;
  content: string | null;
  gif: GifData | null;
  mentions: Mention[];
  // Opt-in only — populated when the hook is called with includeFiles: true.
  // Omitted by default to keep message payloads small in large conversations.
  files?: File[];
  metadata: Record<string, any>;
  parentMessageId: string | null;
  quotedMessageId: string | null;
  threadReplyCount: number;
  // emoji → count (computed server-side, not a DB column)
  reactionCounts: Record<string, number>;
  // emojis the requesting user has reacted with on this message (computed server-side)
  userReactions: string[];
  editedAt: Date | null;
  userDeletedAt: Date | null;
  moderationStatus: "approved" | "removed" | null;
  moderatedAt: Date | null;
  moderatedById: string | null;
  moderatedByType: "client" | "user" | null;
  moderationReason: string | null;
  // ISO strings over the wire (JSON) — the server never sends Date objects, and the optimistic-send
  // path mirrors that. Consumers wrap in `new Date(createdAt)` at the point of use. Kept as `string`
  // (not `Date`) so values in the Redux store stay serializable (RTK serializableCheck).
  createdAt: string;
  updatedAt: string;

  // Populated fields
  // null when userId is null (account deleted) — same pattern as Comment model
  user: User | null;
  // Populated one level deep only. Chains are resolved from the Redux store at render time
  // (via quotedMessageId) so that edits to quoted messages propagate automatically.
  quotedMessage?: ChatMessage | null;
  parentMessage?: ChatMessage | null;

  // Client-only flag — never comes from the server.
  // Set to true by failOptimisticMessage when a send request fails.
  sendFailed?: boolean;
}
