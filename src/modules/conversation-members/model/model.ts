import { z } from 'zod';

export enum ConversationMemberRole {
  MEMBER = 'member',
  ADMIN = 'admin'
}

export const ConversationMemberSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  userId: z.string(),
  role: z.nativeEnum(ConversationMemberRole),

  joinedAt: z.date(),
  leftAt: z.date().optional(),

  // Inbox state
  unreadCount: z.number().default(0),
  lastReadMessageId: z.string().optional(),
  lastReadAt: z.date().optional(),

  muteUntil: z.date().optional(),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),

  updatedAt: z.date()
});

export type ConversationMember = z.infer<typeof ConversationMemberSchema>;
