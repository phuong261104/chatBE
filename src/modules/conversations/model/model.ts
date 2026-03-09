import { z } from 'zod';
import { MessageType } from '@modules/messages/model/model';

export enum ConversationType {
  PRIVATE = 'private',
  GROUP = 'group'
}

export const LastMessageSchema = z.object({
  messageId: z.string(),
  senderId: z.string(),
  type: z.nativeEnum(MessageType),
  textPreview: z.string().optional(),
  createdAt: z.date()
});

export const ConversationSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ConversationType),

  // Private conversation only
  pairKey: z.string().optional(),

  // Group info
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  createdBy: z.string().optional(),

  admins: z.array(z.string()).optional(),
  membersCount: z.number().default(0),

  // Preview (denormalized)
  lastMessage: LastMessageSchema.optional(),
  lastMessageAt: z.date().optional(),

  createdAt: z.date(),
  updatedAt: z.date()
});

export type Conversation = z.infer<typeof ConversationSchema>;
export type LastMessage = z.infer<typeof LastMessageSchema>;
