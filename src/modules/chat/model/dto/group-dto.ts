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
  joinedAt: z.date().optional(),
  leftAt: z.date().nullable().optional(),
  unreadCount: z.number().optional(),
  lastReadMessageId: z.string().optional(),
  lastSeenMessageId: z.string().optional(),
  lastDeliveredMessageId: z.string().optional(),
  lastReadAt: z.date().optional(),
  lastSeenAt: z.date().optional(),
  lastDeliveredAt: z.date().optional(),
  lastReadMessageCreatedAt: z.date().optional(),
  lastSeenMessageCreatedAt: z.date().optional(),
  lastDeliveredMessageCreatedAt: z.date().optional(),
  lastActivityAt: z.date().optional(),
  muteUntil: z.date().optional(),
  pinned: z.boolean().optional(),
  pinnedAt: z.date().nullable().optional(),
  archived: z.boolean().optional(),
  hiddenUserIds: z.array(z.string()).optional(),
  hidden: z.boolean().optional(),
  hiddenAt: z.date().nullable().optional(),
  hiddenPinHash: z.string().nullable().optional(),
  deletedAt: z.date().nullable().optional(),
  historyVisibleFrom: z.date().nullable().optional(),
  nickname: z.string().nullable().optional(),
  nicknameUpdatedAt: z.date().optional(),
  wallpaper: z.string().nullable().optional(),
  wallpaperUpdatedAt: z.date().optional(),
});

export type ConversationMemberUpdateDTO = z.infer<
  typeof ConversationMemberUpdateDTOSchema
>;

export const createGroupDTOSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name is too long"),
  memberIds: z
    .array(uuidV7("Invalid member ID"))
    .min(2, "Group must have at least 3 members including creator")
    .max(49, "Group cannot have more than 50 members including creator"),
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
});

export type CreateGroupDTO = z.infer<typeof createGroupDTOSchema>;

export const addMembersToGroupDTOSchema = z.object({
  conversationId: z.string(),
  requesterId: z.string(),
  memberIds: z
    .array(uuidV7("Invalid member ID"))
    .min(1, "At least one member is required")
    .max(49, "Cannot add more than 49 members at once"),
});

export type AddMembersToGroupDTO = z.infer<typeof addMembersToGroupDTOSchema>;

export const removeMemberFromGroupDTOSchema = z.object({
  conversationId: z.string(),
  requesterId: z.string(),
  targetUserId: z.string(),
  block: z.boolean().optional(),
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
  autoTransferOwner: z.boolean().optional(),
  newOwnerId: z.string().optional(),
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
  whoCanSendMessages: z.enum(["all", "admins"]).optional(),
  whoCanAddMembers: z.enum(["all", "admins"]).optional(),
  whoCanUpdateGroupInfo: z.enum(["all", "admins"]).optional(),
  whoCanPinMessages: z.enum(["all", "admins"]).optional(),
  newMemberCanViewHistory: z.boolean().optional(),
  utilityPermissions: z.object({
    poll: z.enum(["all", "admins"]).optional(),
    reminder: z.enum(["all", "admins"]).optional(),
    note: z.enum(["all", "admins"]).optional(),
  }).optional(),
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
  block?: boolean;
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
  autoTransferOwner?: boolean;
  newOwnerId?: string;
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
  whoCanSendMessages?: "all" | "admins";
  whoCanAddMembers?: "all" | "admins";
  whoCanUpdateGroupInfo?: "all" | "admins";
  whoCanPinMessages?: "all" | "admins";
  newMemberCanViewHistory?: boolean;
  utilityPermissions?: {
    poll?: "all" | "admins";
    reminder?: "all" | "admins";
    note?: "all" | "admins";
  };
}

// ==================== Group Invite Link DTOs ====================

export const getGroupInviteLinkDTOSchema = z.object({
  groupId: z.string(),
  requesterId: z.string(),
});
export type GetGroupInviteLinkDTO = z.infer<typeof getGroupInviteLinkDTOSchema>;

export interface GetGroupInviteLinkQuery {
  groupId: string;
  requesterId: string;
}

export const regenerateGroupInviteLinkDTOSchema = z.object({
  groupId: z.string(),
  requesterId: z.string(),
});
export type RegenerateGroupInviteLinkDTO = z.infer<typeof regenerateGroupInviteLinkDTOSchema>;

export interface RegenerateGroupInviteLinkCommand {
  groupId: string;
  requesterId: string;
}

export const revokeGroupInviteLinkDTOSchema = z.object({
  groupId: z.string(),
  requesterId: z.string(),
});
export type RevokeGroupInviteLinkDTO = z.infer<typeof revokeGroupInviteLinkDTOSchema>;

export interface RevokeGroupInviteLinkCommand {
  groupId: string;
  requesterId: string;
}

export const previewInviteDTOSchema = z.object({
  token: z.string(),
  requesterId: z.string().optional(),
});
export type PreviewInviteDTO = z.infer<typeof previewInviteDTOSchema>;

export interface PreviewInviteQuery {
  token: string;
  requesterId?: string;
}

export const joinGroupByInviteDTOSchema = z.object({
  token: z.string(),
  requesterId: z.string(),
});
export type JoinGroupByInviteDTO = z.infer<typeof joinGroupByInviteDTOSchema>;

export interface JoinGroupByInviteCommand {
  token: string;
  requesterId: string;
}

// ==================== Group Block DTOs ====================

export const getGroupBlocksDTOSchema = z.object({
  groupId: z.string(),
  requesterId: z.string(),
});
export type GetGroupBlocksDTO = z.infer<typeof getGroupBlocksDTOSchema>;

export interface GetGroupBlocksQuery {
  groupId: string;
  requesterId: string;
}

export const blockGroupMemberDTOSchema = z.object({
  targetUserId: z.string(),
});
export type BlockGroupMemberDTO = z.infer<typeof blockGroupMemberDTOSchema>;

export interface BlockGroupMemberCommand {
  groupId: string;
  requesterId: string;
  targetUserId: string;
}

export const unblockGroupMemberDTOSchema = z.object({
  groupId: z.string(),
  requesterId: z.string(),
  targetUserId: z.string(),
});
export type UnblockGroupMemberDTO = z.infer<typeof unblockGroupMemberDTOSchema>;

export interface UnblockGroupMemberCommand {
  groupId: string;
  requesterId: string;
  targetUserId: string;
}
