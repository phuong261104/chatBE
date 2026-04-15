import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationMember,
} from "../model";

export const ConversationMemberCondDTOSchema = z.object({
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  role: z.nativeEnum(ConversationMemberRole).optional(),
  status: z.nativeEnum(ConversationMemberStatus).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export type ConversationMemberCondDTO = z.infer<
  typeof ConversationMemberCondDTOSchema
>;

export const ConversationMemberUpdateDTOSchema = z.object({
  role: z.nativeEnum(ConversationMemberRole).optional(),
  status: z.nativeEnum(ConversationMemberStatus).optional(),
  leftAt: z.date().optional(),
  unreadCount: z.number().optional(),
  lastReadMessageId: z.string().optional(),
  lastSeenMessageId: z.string().optional(),
  lastDeliveredMessageId: z.string().optional(),
  lastReadAt: z.date().optional(),
  muteUntil: z.date().optional(),
  pinned: z.boolean().optional(),
  pinnedAt: z.date().optional(),
  archived: z.boolean().optional(),
});

export type ConversationMemberUpdateDTO = z.infer<
  typeof ConversationMemberUpdateDTOSchema
>;

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
  conversationId: z.string(),
  requesterId: z.string(),
  memberIds: z.array(z.string()).min(1, "At least one member is required"),
});

export type AddMembersToGroupDTO = z.infer<typeof addMembersToGroupDTOSchema>;

export const removeMemberFromGroupDTOSchema = z.object({
  conversationId: z.string(),
  requesterId: z.string(),
  targetUserId: z.string(),
});

export type RemoveMemberFromGroupDTO = z.infer<
  typeof removeMemberFromGroupDTOSchema
>;

export const updateGroupInfoDTOSchema = z.object({
  conversationId: z.string(),
  requesterId: z.string(),
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
});

export type UpdateGroupInfoDTO = z.infer<typeof updateGroupInfoDTOSchema>;

export const getConversationMembersDTOSchema = z.object({
  conversationId: z.string(),
  excludeUserId: z.string().optional(),
});

export type GetConversationMembersDTO = z.infer<
  typeof getConversationMembersDTOSchema
>;

export const leaveGroupDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

export type LeaveGroupDTO = z.infer<typeof leaveGroupDTOSchema>;

export const getGroupMembersDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

export type GetGroupMembersDTO = z.infer<typeof getGroupMembersDTOSchema>;

export const markAsSeenDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  lastSeenMessageId: z.string(),
});

export type MarkAsSeenDTO = z.infer<typeof markAsSeenDTOSchema>;

export const markAsDeliveredDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  lastDeliveredMessageId: z.string(),
});

export type MarkAsDeliveredDTO = z.infer<typeof markAsDeliveredDTOSchema>;

export const muteConversationDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  muteUntil: z.string().datetime().optional(),
  duration: z.number().positive().optional(),
});

export type MuteConversationDTO = z.infer<typeof muteConversationDTOSchema>;

export const pinConversationDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

export type PinConversationDTO = z.infer<typeof pinConversationDTOSchema>;

export const archiveConversationDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

export type ArchiveConversationDTO = z.infer<typeof archiveConversationDTOSchema>;

export const pinMessageDTOSchema = z.object({
  messageId: z.string(),
  userId: z.string(),
});

export type PinMessageDTO = z.infer<typeof pinMessageDTOSchema>;

export const unpinMessageDTOSchema = z.object({
  messageId: z.string(),
  userId: z.string(),
});

export type UnpinMessageDTO = z.infer<typeof unpinMessageDTOSchema>;

export const getPinnedMessagesDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

export type GetPinnedMessagesDTO = z.infer<typeof getPinnedMessagesDTOSchema>;

export const setAdminDTOSchema = z.object({
  groupId: z.string(),
  requesterId: z.string(),
  targetUserId: z.string(),
  isAdmin: z.boolean(),
});

export type SetAdminDTO = z.infer<typeof setAdminDTOSchema>;

export const transferOwnerDTOSchema = z.object({
  groupId: z.string(),
  requesterId: z.string(),
  newOwnerId: z.string(),
});

export type TransferOwnerDTO = z.infer<typeof transferOwnerDTOSchema>;

export const updateGroupSettingsDTOSchema = z.object({
  groupId: uuidV7("Invalid group ID"),
  allowSendLink: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  allowMemberInvite: z.boolean().optional(),
});

export type UpdateGroupSettingsDTO = z.infer<typeof updateGroupSettingsDTOSchema>;

export interface CreateGroupCommand {
  creatorId: string;
  data: CreateGroupDTO;
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

export interface GetGroupMembersQuery {
  conversationId: string;
  userId: string;
}

export interface GetConversationMembersQuery {
  conversationId: string;
  excludeUserId?: string;
}

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

export interface PinMessageCommand {
  messageId: string;
  userId: string;
}

export interface UnpinMessageCommand {
  messageId: string;
  userId: string;
}

export interface GetPinnedMessagesQuery {
  conversationId: string;
  userId: string;
}

export interface SetAdminCommand {
  groupId: string;
  requesterId: string;
  targetUserId: string;
  isAdmin: boolean;
}

export interface TransferOwnerCommand {
  groupId: string;
  requesterId: string;
  newOwnerId: string;
}

export interface UpdateGroupSettingsCommand {
  groupId: string;
  requesterId: string;
  allowSendLink?: boolean;
  requireApproval?: boolean;
  allowMemberInvite?: boolean;
}
