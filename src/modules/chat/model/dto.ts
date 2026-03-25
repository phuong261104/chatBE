import { z } from "zod";
import {
  ConversationType,
  ConversationMemberRole,
  MessageType,
  LastMessageSchema,
  MessageMediaSchema,
  Conversation,
  ConversationMember,
  Message,
  MediaAttachmentSchema,
} from "./model";

export const ConversationCondDTOSchema = z.object({
  type: z.nativeEnum(ConversationType).optional(),
  pairKey: z.string().optional(),
  createdBy: z.string().optional(),
});

export type ConversationCondDTO = z.infer<typeof ConversationCondDTOSchema>;

export const ConversationUpdateDTOSchema = z.object({
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  admins: z.array(z.string()).optional(),
  membersCount: z.number().optional(),
  lastMessage: LastMessageSchema.optional(),
  lastMessageAt: z.date().optional(),
});

export type ConversationUpdateDTO = z.infer<typeof ConversationUpdateDTOSchema>;

export const ConversationMemberCondDTOSchema = z.object({
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  role: z.nativeEnum(ConversationMemberRole).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export type ConversationMemberCondDTO = z.infer<
  typeof ConversationMemberCondDTOSchema
>;

export const ConversationMemberUpdateDTOSchema = z.object({
  role: z.nativeEnum(ConversationMemberRole).optional(),
  leftAt: z.date().optional(),
  unreadCount: z.number().optional(),
  lastReadMessageId: z.string().optional(),
  lastSeenMessageId: z.string().optional(),
  lastDeliveredMessageId: z.string().optional(),
  lastReadAt: z.date().optional(),
  muteUntil: z.date().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export type ConversationMemberUpdateDTO = z.infer<
  typeof ConversationMemberUpdateDTOSchema
>;

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
  editedAt: z.date().optional(),
  deletedAt: z.date().optional(),
  deletedForUserIds: z.array(z.string()).optional(),
});

export type MessageUpdateDTO = z.infer<typeof MessageUpdateDTOSchema>;

export const createGroupDTOSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name is too long"),
  memberIds: z.array(z.string()).min(1, "At least one member is required"),
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
});

export type CreateGroupDTO = z.infer<typeof createGroupDTOSchema>;

export const addMembersToGroupDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  requesterId: z.string().uuid("Invalid requester ID"),
  memberIds: z.array(z.string()).min(1, "At least one member is required"),
});

export type AddMembersToGroupDTO = z.infer<typeof addMembersToGroupDTOSchema>;

export const removeMemberFromGroupDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  requesterId: z.string().uuid("Invalid requester ID"),
  targetUserId: z.string().uuid("Invalid target user ID"),
});

export type RemoveMemberFromGroupDTO = z.infer<
  typeof removeMemberFromGroupDTOSchema
>;

export const updateGroupInfoDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  requesterId: z.string().uuid("Invalid requester ID"),
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
});

export type UpdateGroupInfoDTO = z.infer<typeof updateGroupInfoDTOSchema>;

export const sendMessageDTOSchema = z
  .object({
    conversationId: z.string().uuid("Invalid conversation ID"),
    senderId: z.string().uuid("Invalid sender ID"),
    text: z.string().max(5000, "Message is too long").optional(),
    media: z.array(MediaAttachmentSchema).optional(),
  })
  .refine((data) => data.text || (data.media && data.media.length > 0), {
    message: "Either text or media is required",
  });

export type SendMessageDTO = z.infer<typeof sendMessageDTOSchema>;

export const getOrCreatePrivateConversationDTOSchema = z.object({
  currentUserId: z.string().uuid("Invalid current user ID"),
  targetUserId: z.string().uuid("Invalid target user ID"),
});

export type GetOrCreatePrivateConversationDTO = z.infer<
  typeof getOrCreatePrivateConversationDTOSchema
>;

export const sendGroupMessageDTOSchema = z
  .object({
    conversationId: z.string().uuid("Invalid conversation ID"),
    senderId: z.string().uuid("Invalid sender ID"),
    text: z.string().max(5000, "Message is too long").optional(),
    media: z.array(MediaAttachmentSchema).optional(),
  })
  .refine((data) => data.text || (data.media && data.media.length > 0), {
    message: "Either text or media is required",
  });

export type SendGroupMessageDTO = z.infer<typeof sendGroupMessageDTOSchema>;

export const getConversationMembersDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  excludeUserId: z.string().uuid().optional(),
});

export type GetConversationMembersDTO = z.infer<
  typeof getConversationMembersDTOSchema
>;

export const UserCondDTOSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  username: z.string().optional(),
  status: z.string().optional(),
});

export type UserCondDTO = z.infer<typeof UserCondDTOSchema>;

export const loadMessagesDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type LoadMessagesDTO = z.infer<typeof loadMessagesDTOSchema>;

export const markAsSeenDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  userId: z.string().uuid("Invalid user ID"),
  lastSeenMessageId: z.string().uuid("Invalid message ID"),
});

export type MarkAsSeenDTO = z.infer<typeof markAsSeenDTOSchema>;

export const markAsDeliveredDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  userId: z.string().uuid("Invalid user ID"),
  lastDeliveredMessageId: z.string().uuid("Invalid message ID"),
});

export type MarkAsDeliveredDTO = z.infer<typeof markAsDeliveredDTOSchema>;

export const leaveGroupDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  userId: z.string().uuid("Invalid user ID"),
});

export type LeaveGroupDTO = z.infer<typeof leaveGroupDTOSchema>;

export const getGroupMembersDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  userId: z.string().uuid("Invalid user ID"),
});

export type GetGroupMembersDTO = z.infer<typeof getGroupMembersDTOSchema>;

export const revokeMessageDTOSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
  userId: z.string().uuid("Invalid user ID"),
});

export type RevokeMessageDTO = z.infer<typeof revokeMessageDTOSchema>;

export const deleteMessageForMeDTOSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
  userId: z.string().uuid("Invalid user ID"),
});

export type DeleteMessageForMeDTO = z.infer<typeof deleteMessageForMeDTOSchema>;

export const forwardMessagesDTOSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  messageIds: z
    .array(z.string().uuid("Invalid message ID"))
    .min(1, "At least one message is required"),
  targetConversationIds: z
    .array(z.string().uuid("Invalid conversation ID"))
    .min(1, "At least one target conversation is required"),
});

export type ForwardMessagesDTO = z.infer<typeof forwardMessagesDTOSchema>;

export interface CreateGroupCommand {
  creatorId: string;
  data: CreateGroupDTO;
}

import { MediaAttachment } from "./model";

export interface CreateGroupResult {
  conversation: Conversation;
  members: ConversationMember[];
  systemMessage: Message;
}

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

export interface GetOrCreatePrivateConversationCommand {
  currentUserId: string;
  targetUserId: string;
}

export interface AddMembersToGroupCommand {
  conversationId: string;
  requesterId: string;
  memberIds: string[];
}

export interface RemoveMemberFromGroupCommand {
  conversationId: string;
  requesterId: string;
  targetUserId: string;
}

export interface UpdateGroupInfoCommand {
  conversationId: string;
  requesterId: string;
  name?: string;
  avatarUrl?: string;
}

export interface MarkAsSeenCommand {
  conversationId: string;
  userId: string;
  lastSeenMessageId: string;
}

export interface MarkAsDeliveredCommand {
  conversationId: string;
  userId: string;
  lastDeliveredMessageId: string;
}

export interface LeaveGroupCommand {
  conversationId: string;
  userId: string;
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

export interface GetConversationsQuery {
  userId: string;
  page?: number;
  limit?: number;
}

export type ConversationWithMetadata = Conversation & {
  unreadCount: number;
  role: ConversationMemberRole;
};

export interface GetConversationDetailQuery {
  conversationId: string;
  userId: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  members: ConversationMember[];
  currentUserRole: ConversationMemberRole;
}

export interface GetConversationMembersQuery {
  conversationId: string;
  excludeUserId?: string;
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

export interface GetTotalUnreadCountQuery {
  userId: string;
}

export interface GetGroupMembersQuery {
  conversationId: string;
  userId: string;
}

export const muteConversationDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  userId: z.string().uuid("Invalid user ID"),
  muteUntil: z.string().datetime().optional(),
  duration: z.number().positive().optional(),
});

export type MuteConversationDTO = z.infer<typeof muteConversationDTOSchema>;

export const pinConversationDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  userId: z.string().uuid("Invalid user ID"),
});

export type PinConversationDTO = z.infer<typeof pinConversationDTOSchema>;

export const archiveConversationDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  userId: z.string().uuid("Invalid user ID"),
});

export type ArchiveConversationDTO = z.infer<typeof archiveConversationDTOSchema>;

export const editMessageDTOSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
  userId: z.string().uuid("Invalid user ID"),
  text: z.string().min(1, "Text is required").max(5000, "Message is too long"),
});

export type EditMessageDTO = z.infer<typeof editMessageDTOSchema>;

export interface MuteConversationCommand {
  conversationId: string;
  userId: string;
  muteUntil?: string;
  duration?: number;
}

export interface UnmuteConversationCommand {
  conversationId: string;
  userId: string;
}

export interface PinConversationCommand {
  conversationId: string;
  userId: string;
}

export interface UnpinConversationCommand {
  conversationId: string;
  userId: string;
}

export interface ArchiveConversationCommand {
  conversationId: string;
  userId: string;
}

export interface UnarchiveConversationCommand {
  conversationId: string;
  userId: string;
}

export interface EditMessageCommand {
  messageId: string;
  userId: string;
  text: string;
}
