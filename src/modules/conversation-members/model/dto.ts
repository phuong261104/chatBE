import { z } from 'zod';
import { ConversationMemberRole } from './model';

export const ConversationMemberCreateSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  role: z.nativeEnum(ConversationMemberRole).default(ConversationMemberRole.MEMBER)
});

export type ConversationMemberCreateDTO = z.infer<typeof ConversationMemberCreateSchema>;

export const ConversationMemberUpdateSchema = z.object({
  role: z.nativeEnum(ConversationMemberRole).optional(),
  leftAt: z.date().optional(),
  unreadCount: z.number().optional(),
  lastReadMessageId: z.string().optional(),
  lastReadAt: z.date().optional(),
  muteUntil: z.date().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional()
});

export type ConversationMemberUpdateDTO = z.infer<typeof ConversationMemberUpdateSchema>;

export const ConversationMemberCondDTOSchema = z.object({
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  role: z.nativeEnum(ConversationMemberRole).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional()
});

export type ConversationMemberCondDTO = z.infer<typeof ConversationMemberCondDTOSchema>;
