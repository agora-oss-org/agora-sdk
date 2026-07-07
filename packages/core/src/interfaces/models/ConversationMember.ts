import { User } from "./User";

export type ConversationMemberRole = "admin" | "member";

export interface ConversationMember {
  id: string;
  projectId: string;
  conversationId: string;
  userId: string;
  role: ConversationMemberRole | null;
  lastReadAt: string | null;
  // Personal mute state, present ONLY on the viewer's own row (omitted for other
  // members). For a timed mute this is a real ISO timestamp; when muted
  // "forever" this is `null` and `mutedForever` is `true` (the storage sentinel
  // is never exposed as a magic date). `null` + `mutedForever: false` = not muted.
  mutedUntil?: string | null;
  // Explicit "forever" signal for the viewer's own row (self-serialized). Absent
  // on other members' rows.
  mutedForever?: boolean;
  isActive: boolean;
  leftAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated
  user?: User;
}
