import { z } from "zod";

export enum ConversationType {
  PRIVATE = "private",
  GROUP = "group",
}

export enum ConversationMemberRole {
  OWNER = "owner",
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
  LINK = "link",
  VIDEO = "video",
  VOICE = "voice",
  STICKER = "sticker",
  GIF = "gif",
  CALL = "call",
  SYSTEM = "system",
  PROFILE_CARD = "profile_card",
  POLL = "poll",
  REMINDER = "reminder",
}

export enum MessageStatus {
  ACTIVE = "active",
  REVOKED = "revoked",
}

export enum ClassificationType {
  IMAGE = "image",
  VIDEO = "video",
  VOICE = "voice",
  FILE = "file",
  LINK = "link",
}

export enum MediaType {
  IMAGE = "image",
  FILE = "file",
  VIDEO = "video",
  AUDIO = "audio",
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
  whoCanSendMessages: z.enum(["all", "admins"]).default("all"),
  whoCanAddMembers: z.enum(["all", "admins"]).default("all"),
  utilityPermissions: z.object({
    poll: z.enum(["all", "admins"]).default("all"),
    reminder: z.enum(["all", "admins"]).default("all"),
    note: z.enum(["all", "admins"]).default("all"),
  }).default({
    poll: "all",
    reminder: "all",
    note: "all",
  }),
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
  lastReadMessageCreatedAt: z.date().optional(),
  lastSeenMessageId: z.string().optional(),
  lastDeliveredMessageId: z.string().optional(),
  lastSeenAt: z.date().optional(),
  lastDeliveredAt: z.date().optional(),
  lastSeenMessageCreatedAt: z.date().optional(),
  lastDeliveredMessageCreatedAt: z.date().optional(),
  lastActivityAt: z.date().optional(),

  muteUntil: z.date().optional(),
  pinned: z.boolean().default(false),
  pinnedAt: z.date().optional(),
  archived: z.boolean().default(false),

  hiddenUserIds: z.array(z.string()).default([]),
  hidden: z.boolean().optional(),
  hiddenAt: z.date().optional(),
  hiddenPinHash: z.string().optional(),

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
  duration: z.number().optional(),
  thumbnailUrl: z.string().optional(),
});

export type MessageMedia = z.infer<typeof MessageMediaSchema>;

export const MessageReactionSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  userId: z.string(),
  emoji: z.string(),
  count: z.number().default(1),
  createdAt: z.date(),
  user: z
    .object({
      id: z.string(),
      avatarUrl: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
});

export type MessageReaction = z.infer<typeof MessageReactionSchema>;

export const MessageClassificationSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  type: z.nativeEnum(ClassificationType),
  senderId: z.string(),
  url: z.string().optional(),
  name: z.string().optional(),
  linkUrl: z.string().optional(),
  messageId: z.string(),
  createdAt: z.date(),
});

export type MessageClassification = z.infer<typeof MessageClassificationSchema>;

export const MessageMentionSchema = z.object({
  userId: z.string(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  startIndex: z.number(),
  endIndex: z.number(),
});

export type MessageMention = z.infer<typeof MessageMentionSchema>;

export const CallMessageMetadataSchema = z.object({
  callId: z.string(),
  roomName: z.string(),
  callType: z.enum(["audio", "video"]),
  status: z.enum(["completed", "missed", "rejected", "cancelled"]),
  callerId: z.string(),
  calleeIds: z.array(z.string()),
  answeredAt: z.date().optional(),
  endedAt: z.date(),
  endedBy: z.string().optional(),
  durationSeconds: z.number().optional(),
  participantOutcomes: z
    .record(
      z.object({
        status: z.string(),
        joinedAt: z.date().optional(),
        leftAt: z.date().optional(),
        endedAt: z.date().optional(),
      }),
    )
    .optional(),
});

export type CallMessageMetadata = z.infer<typeof CallMessageMetadataSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  clientMessageId: z.string().optional(),
  type: z.nativeEnum(MessageType),
  text: z.string().optional(),
  media: z.array(MessageMediaSchema).optional(),
  links: z.array(z.string()).optional(),
  call: CallMessageMetadataSchema.optional(),
  profileCardUserId: z.string().optional(),
  pollId: z.string().optional(),
  reminderId: z.string().optional(),
  systemAction: z.string().optional(),
  systemRefId: z.string().optional(),
  poll: z.any().optional(),
  reminder: z.any().optional(),
  messageStatus: z.nativeEnum(MessageStatus).default(MessageStatus.ACTIVE).optional(),
  deletedBy: z.string().optional(),
  revokedAt: z.date().optional(),
  deletedForUserIds: z.array(z.string()).optional(),
  quotedMessageId: z.string().optional(),
  quotedMessagePreview: z.string().optional(),
  forwardedFrom: z.string().optional(),
  forwardedFromMessageId: z.string().optional(),
  mentions: z.array(MessageMentionSchema).optional(),
  createdAt: z.date(),
  editedAt: z.date().optional(),
  deletedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  expireAtEpoch: z.number().optional(),
  pinned: z.boolean().default(false),
  pinnedAt: z.date().optional(),
  readBy: z
    .array(
      z.object({
        userId: z.string(),
        readAt: z.date(),
      }),
    )
    .optional(),
  reactions: z.array(z.any()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export enum UserStatus {
  ACTIVE = "active",
  DISABLED = "disabled",
}

export enum PollStatus {
  ACTIVE = "active",
  CLOSED = "closed",
}

export enum GroupReminderStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  DONE = "done",
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
  messageId: z.string().optional(),
  question: z.string(),
  options: z.array(PollOptionSchema),
  createdBy: z.string(),
  isMultipleChoice: z.boolean().default(false),
  allowAddOption: z.boolean().default(false),
  showResultsBeforeClose: z.boolean().default(true),
  hideVoters: z.boolean().default(false),
  status: z.nativeEnum(PollStatus).default(PollStatus.ACTIVE),
  expiresAt: z.date().optional(),
  closedAt: z.date().optional(),
  closedBy: z.string().optional(),
  pinned: z.boolean().default(false),
  pinnedAt: z.date().optional(),
  pinnedBy: z.string().optional(),
  totalVotes: z.number().default(0),
  lastVoteActivityAt: z.date().optional(),
  lastVoteActivityMessageId: z.string().optional(),
  voteActivityCount: z.number().default(0).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Poll = z.infer<typeof PollSchema>;

export enum GroupReminderRepeatRule {
  NONE = "none",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

export const GroupReminderSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  messageId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  remindAt: z.date(),
  repeatRule: z.nativeEnum(GroupReminderRepeatRule).default(GroupReminderRepeatRule.NONE),
  notifyBeforeMinutes: z.number().int().min(0).default(0),
  nextNotifyAt: z.date().optional(),
  lastNotifiedAt: z.date().optional(),
  status: z.nativeEnum(GroupReminderStatus).default(GroupReminderStatus.ACTIVE),
  pinned: z.boolean().default(false),
  pinnedAt: z.date().optional(),
  pinnedBy: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type GroupReminder = z.infer<typeof GroupReminderSchema>;

export const GroupNoteSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  title: z.string(),
  content: z.string(),
  createdBy: z.string(),
  updatedBy: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type GroupNote = z.infer<typeof GroupNoteSchema>;
