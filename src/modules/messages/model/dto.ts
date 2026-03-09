import { z } from 'zod';
import { MessageType, MessageMediaSchema } from './model';

export const MessageCreateSchema = z
  .object({
    conversationId: z.string(),
    senderId: z.string(),
    type: z.nativeEnum(MessageType),
    text: z.string().optional(),
    media: z.array(MessageMediaSchema).optional()
  })
  .refine(
    (data) => {
      if (data.type === MessageType.TEXT) {
        return !!data.text;
      }
      return true;
    },
    {
      message: 'Text is required for text messages'
    }
  );

export type MessageCreateDTO = z.infer<typeof MessageCreateSchema>;

export const MessageUpdateSchema = z.object({
  text: z.string().optional(),
  editedAt: z.date().optional(),
  deletedAt: z.date().optional()
});

export type MessageUpdateDTO = z.infer<typeof MessageUpdateSchema>;

export const MessageCondDTOSchema = z.object({
  conversationId: z.string().optional(),
  senderId: z.string().optional(),
  type: z.nativeEnum(MessageType).optional()
});

export type MessageCondDTO = z.infer<typeof MessageCondDTOSchema>;
