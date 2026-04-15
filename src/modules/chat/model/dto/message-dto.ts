import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";
import {
  MessageType,
  MessageMediaSchema,
  MediaAttachmentSchema,
  MediaAttachment,
  Message,
} from "../model";

export const MessageCondDTOSchema = z.object({
  conversationId: z.string().optional(),
  senderId: z.string().optional(),
  type: z.nativeEnum(MessageType).optional(),
});

export type MessageCondDTO = z.infer<typeof MessageCondDTOSchema>;

export const MessageUpdateDTOSchema = z.object({
  type: z.nativeEnum(MessageType).optional(),
  text: z.string().optional(),
  media: z.array(MessageMediaSchema).optional(),
  links: z.array(z.string()).optional(),
  editedAt: z.date().optional(),
  deletedAt: z.date().optional(),
  deletedForUserIds: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
  pinnedAt: z.date().optional(),
});

export type MessageUpdateDTO = z.infer<typeof MessageUpdateDTOSchema>;

export const sendMessageDTOSchema = z
  .object({
    conversationId: uuidV7("Invalid conversation ID"),
    senderId: uuidV7("Invalid sender ID"),
    text: z.string().max(5000, "Message is too long").optional(),
    media: z.array(MediaAttachmentSchema).optional(),
  })
  .refine((data) => data.text || (data.media && data.media.length > 0), {
    message: "Either text or media is required",
  });

export type SendMessageDTO = z.infer<typeof sendMessageDTOSchema>;

export const sendGroupMessageDTOSchema = z
  .object({
    conversationId: uuidV7("Invalid conversation ID"),
    senderId: uuidV7("Invalid sender ID"),
    text: z.string().max(5000, "Message is too long").optional(),
    media: z.array(MediaAttachmentSchema).optional(),
  })
  .refine((data) => data.text || (data.media && data.media.length > 0), {
    message: "Either text or media is required",
  });

export type SendGroupMessageDTO = z.infer<typeof sendGroupMessageDTOSchema>;

export const loadMessagesDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type LoadMessagesDTO = z.infer<typeof loadMessagesDTOSchema>;

export const revokeMessageDTOSchema = z.object({
  messageId: uuidV7("Invalid message ID"),
  userId: uuidV7("Invalid user ID"),
});

export type RevokeMessageDTO = z.infer<typeof revokeMessageDTOSchema>;

export const deleteMessageForMeDTOSchema = z.object({
  messageId: uuidV7("Invalid message ID"),
  userId: uuidV7("Invalid user ID"),
});

export type DeleteMessageForMeDTO = z.infer<typeof deleteMessageForMeDTOSchema>;

export const deleteMessageForEveryoneDTOSchema = z.object({
  messageId: uuidV7("Invalid message ID"),
  userId: uuidV7("Invalid user ID"),
});

export type DeleteMessageForEveryoneDTO = z.infer<typeof deleteMessageForEveryoneDTOSchema>;

export const forwardMessagesDTOSchema = z.object({
  userId: uuidV7("Invalid user ID"),
  messageIds: z
    .array(uuidV7("Invalid message ID"))
    .min(1, "At least one message is required"),
  targetConversationIds: z
    .array(uuidV7("Invalid conversation ID"))
    .min(1, "At least one target conversation is required"),
});

export type ForwardMessagesDTO = z.infer<typeof forwardMessagesDTOSchema>;

export const editMessageDTOSchema = z.object({
  messageId: uuidV7("Invalid message ID"),
  userId: uuidV7("Invalid user ID"),
  text: z.string().min(1, "Text is required").max(5000, "Message is too long"),
});

export type EditMessageDTO = z.infer<typeof editMessageDTOSchema>;

export const quoteMessageDTOSchema = z
  .object({
    senderId: uuidV7("Invalid sender ID"),
    text: z.string().max(5000, "Message is too long").optional(),
    media: z.array(MediaAttachmentSchema).optional(),
    quotedMessageId: uuidV7("Invalid quoted message ID"),
  })
  .refine((data) => data.text || (data.media && data.media.length > 0), {
    message: "Either text or media is required",
  });

export type QuoteMessageDTO = z.infer<typeof quoteMessageDTOSchema>;

export interface SendMessageCommand {
  conversationId: string;
  senderId: string;
  text?: string;
  media?: MediaAttachment[];
}

export interface SendGroupMessageCommand {
  conversationId: string;
  senderId: string;
  text?: string;
  media?: MediaAttachment[];
}

export interface RevokeMessageCommand {
  messageId: string;
  userId: string;
}

export interface DeleteMessageForMeCommand {
  messageId: string;
  userId: string;
}

export interface ForwardMessagesCommand {
  userId: string;
  messageIds: string[];
  targetConversationIds: string[];
}

export interface EditMessageCommand {
  messageId: string;
  userId: string;
  text: string;
}

export interface QuoteMessageCommand {
  conversationId: string;
  senderId: string;
  text?: string;
  media?: MediaAttachment[];
  quotedMessageId: string;
}

export interface LoadMessagesQuery {
  conversationId: string;
  userId: string;
  cursor?: string;
  limit: number;
}

export interface LoadMessagesResult {
  messages: Message[];
  nextCursor: string;
  hasMore: boolean;
}
