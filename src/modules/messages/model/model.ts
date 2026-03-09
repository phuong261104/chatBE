import { z } from 'zod';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system'
}

export enum MediaType {
  IMAGE = 'image',
  FILE = 'file'
}

export const MessageMediaSchema = z.object({
  url: z.string(),
  mediaType: z.nativeEnum(MediaType),
  name: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional()
});

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  type: z.nativeEnum(MessageType),
  text: z.string().optional(),
  media: z.array(MessageMediaSchema).optional(),
  createdAt: z.date(),
  editedAt: z.date().optional(),
  deletedAt: z.date().optional()
});

export type Message = z.infer<typeof MessageSchema>;
export type MessageMedia = z.infer<typeof MessageMediaSchema>;
