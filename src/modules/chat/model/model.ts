import { z } from "zod";

export enum ConversationType {
  PRIVATE = "private",
  GROUP = "group",
}

export enum ConversationMemberRole {
  MEMBER = "member",
  ADMIN = "admin",
}

export enum ConversationMemberStatus {
  ACTIVE = "active",
  PENDING = "pending",
  REJECTED = "rejected",
}

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
  SYSTEM = "system",
}

export enum MediaType {
  IMAGE = "image",
  FILE = "file",
}

export const LastMessageSchema = z.object({
  messageId: z.string(),
  senderId: z.string(),
  type: z.nativeEnum(MessageType),
  textPreview: z.string().optional(),
  createdAt: z.date(),
});

export type LastMessage = z.infer<typeof LastMessageSchema>;

export const GroupSettingsSchema = z.object({
  allowSendLink: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
  allowMemberInvite: z.boolean().default(true),
});

export type GroupSettings = z.infer<typeof GroupSettingsSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ConversationType),

  pairKey: z.string().optional(),

  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  createdBy: z.string().optional(),
  ownerId: z.string().optional(),
  admins: z.array(z.string()).optional(),
  membersCount: z.number().default(0),
  settings: GroupSettingsSchema.optional(),

  lastMessage: LastMessageSchema.optional(),
  lastMessageAt: z.date().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

export const ConversationMemberSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  userId: z.string(),
  role: z.nativeEnum(ConversationMemberRole),
  status: z.nativeEnum(ConversationMemberStatus).default(ConversationMemberStatus.ACTIVE),

  joinedAt: z.date(),
  leftAt: z.date().optional(),

  unreadCount: z.number().default(0),
  lastReadMessageId: z.string().optional(),
  lastReadAt: z.date().optional(),
  lastSeenMessageId: z.string().optional(),
  lastDeliveredMessageId: z.string().optional(),

  muteUntil: z.date().optional(),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),

  updatedAt: z.date(),
});

export type ConversationMember = z.infer<typeof ConversationMemberSchema>;

export const MediaAttachmentSchema = z.object({
  url: z.string(),
  filename: z.string(),
  mimetype: z.string(),
  size: z.number(),
});

export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;

export const MessageMediaSchema = z.object({
  url: z.string(),
  mediaType: z.nativeEnum(MediaType),
  name: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export type MessageMedia = z.infer<typeof MessageMediaSchema>;

export const MessageReactionSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  userId: z.string(),
  emoji: z.string(),
  count: z.number().default(1),
  createdAt: z.date(),
});

export type MessageReaction = z.infer<typeof MessageReactionSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  type: z.nativeEnum(MessageType),
  text: z.string().optional(),
  media: z.array(MessageMediaSchema).optional(),
  deletedForUserIds: z.array(z.string()).optional(),
  quotedMessageId: z.string().optional(),
  quotedMessagePreview: z.string().optional(),
  createdAt: z.date(),
  editedAt: z.date().optional(),
  deletedAt: z.date().optional(),
  pinned: z.boolean().default(false),
  pinnedAt: z.date().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export enum UserStatus {
  ACTIVE = "active",
  DISABLED = "disabled",
}

export const UserInfoSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  status: z.nativeEnum(UserStatus),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

export const PollOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  voteCount: z.number().default(0),
  votedUserIds: z.array(z.string()).default([]),
});

export type PollOption = z.infer<typeof PollOptionSchema>;

export const PollSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  question: z.string(),
  options: z.array(PollOptionSchema),
  createdBy: z.string(),
  isMultipleChoice: z.boolean().default(false),
  allowAddOption: z.boolean().default(false),
  expiresAt: z.date().optional(),
  totalVotes: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Poll = z.infer<typeof PollSchema>;
