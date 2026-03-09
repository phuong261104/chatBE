import { z } from 'zod';
import { ConversationType, LastMessageSchema } from './model';

export const ConversationCreateSchema = z.object({
  type: z.nativeEnum(ConversationType),
  pairKey: z.string().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  createdBy: z.string().optional(),
  admins: z.array(z.string()).optional(),
  membersCount: z.number().optional()
});

export type ConversationCreateDTO = z.infer<typeof ConversationCreateSchema>;

export const ConversationUpdateSchema = z.object({
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  admins: z.array(z.string()).optional(),
  membersCount: z.number().optional(),
  lastMessage: LastMessageSchema.optional(),
  lastMessageAt: z.date().optional()
});

export type ConversationUpdateDTO = z.infer<typeof ConversationUpdateSchema>;

export const ConversationCondDTOSchema = z.object({
  type: z.nativeEnum(ConversationType).optional(),
  pairKey: z.string().optional(),
  createdBy: z.string().optional()
});

export type ConversationCondDTO = z.infer<typeof ConversationCondDTOSchema>;
