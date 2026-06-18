import { User } from "./User";

export type ConversationMemberRole = "admin" | "member";

export interface ConversationMember {
  id: string;
  projectId: string;
  conversationId: string;
  userId: string;
  role: ConversationMemberRole | null;
  lastReadAt: string | null;
  // Reserved for future mute functionality — no logic reads this in v1
  mutedUntil: string | null;
  isActive: boolean;
  leftAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated
  user?: User;
}
