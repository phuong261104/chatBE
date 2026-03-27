import { Schema, model } from "mongoose";
import {
  ConversationType,
  ConversationMemberRole,
  MessageType,
  MediaType,
} from "../../../model/model";

interface IConversationDocument {
  _id: string;
  type: ConversationType;

  pairKey?: string;

  name?: string;
  avatarUrl?: string;
  createdBy?: string;

  admins?: string[];
  membersCount: number;

  lastMessage?: {
    messageId: string;
    senderId: string;
    type: MessageType;
    textPreview?: string;
    createdAt: Date;
  };

  lastMessageAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversationDocument>(
  {
    _id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ConversationType),
      required: true,
    },
    pairKey: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: false,
    },
    avatarUrl: {
      type: String,
      required: false,
    },
    createdBy: {
      type: String,
      required: false,
      ref: "User",
    },
    admins: {
      type: [String],
      required: false,
      default: [],
    },
    membersCount: {
      type: Number,
      required: true,
      default: 0,
    },
    lastMessage: {
      messageId: {
        type: String,
        required: false,
      },
      senderId: {
        type: String,
        required: false,
      },
      type: {
        type: String,
        enum: Object.values(MessageType),
        required: false,
      },
      textPreview: {
        type: String,
        required: false,
      },
      createdAt: {
        type: Date,
        required: false,
      },
    },
    lastMessageAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "conversations",
  },
);

ConversationSchema.index({ pairKey: 1 });
ConversationSchema.index({ type: 1 });
ConversationSchema.index({ createdBy: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

export const ConversationModel = model<IConversationDocument>(
  "Conversation",
  ConversationSchema,
);

interface IConversationMemberDocument {
  _id: string;
  conversationId: string;
  userId: string;
  role: ConversationMemberRole;

  joinedAt: Date;
  leftAt?: Date;

  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: Date;
  lastSeenMessageId?: string;
  lastDeliveredMessageId?: string;

  muteUntil?: Date;
  pinned: boolean;
  archived: boolean;

  updatedAt: Date;
}

const ConversationMemberSchema = new Schema<IConversationMemberDocument>(
  {
    _id: {
      type: String,
      required: true,
    },
    conversationId: {
      type: String,
      required: true,
      ref: "Conversation",
    },
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    role: {
      type: String,
      enum: Object.values(ConversationMemberRole),
      required: true,
      default: ConversationMemberRole.MEMBER,
    },
    joinedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      required: false,
    },
    unreadCount: {
      type: Number,
      required: true,
      default: 0,
    },
    lastReadMessageId: {
      type: String,
      required: false,
    },
    lastReadAt: {
      type: Date,
      required: false,
    },
    lastSeenMessageId: {
      type: String,
      required: false,
    },
    lastDeliveredMessageId: {
      type: String,
      required: false,
    },
    muteUntil: {
      type: Date,
      required: false,
    },
    pinned: {
      type: Boolean,
      required: true,
      default: false,
    },
    archived: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "conversation_members",
  },
);

ConversationMemberSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true },
);
ConversationMemberSchema.index({
  userId: 1,
  archived: 1,
  pinned: -1,
  updatedAt: -1,
});
ConversationMemberSchema.index({ conversationId: 1, leftAt: 1 });

export const ConversationMemberModel = model<IConversationMemberDocument>(
  "ConversationMember",
  ConversationMemberSchema,
);

interface IMessageDocument {
  _id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  text?: string;
  media?: Array<{
    url: string;
    mediaType: MediaType;
    name?: string;
    size?: number;
    width?: number;
    height?: number;
  }>;
  deletedForUserIds?: string[];
  quotedMessageId?: string;
  quotedMessagePreview?: string;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
  pinned: boolean;
  pinnedAt?: Date;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    _id: {
      type: String,
      required: true,
    },
    conversationId: {
      type: String,
      required: true,
      ref: "Conversation",
    },
    senderId: {
      type: String,
      required: true,
      ref: "User",
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      required: true,
    },
    text: {
      type: String,
      required: false,
    },
    media: [
      {
        url: {
          type: String,
          required: true,
        },
        mediaType: {
          type: String,
          enum: Object.values(MediaType),
          required: true,
        },
        name: {
          type: String,
          required: false,
        },
        size: {
          type: Number,
          required: false,
        },
        width: {
          type: Number,
          required: false,
        },
        height: {
          type: Number,
          required: false,
        },
      },
    ],
    deletedForUserIds: {
      type: [String],
      required: false,
      default: [],
    },
    quotedMessageId: {
      type: String,
      required: false,
    },
    quotedMessagePreview: {
      type: String,
      required: false,
    },
    editedAt: {
      type: Date,
      required: false,
    },
    deletedAt: {
      type: Date,
      required: false,
    },
    pinned: {
      type: Boolean,
      required: true,
      default: false,
    },
    pinnedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "messages",
  },
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, deletedAt: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, deletedForUserIds: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, pinned: 1, pinnedAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ quotedMessageId: 1 });

export const MessageModel = model<IMessageDocument>("Message", MessageSchema);

interface IMessageReactionDocument {
  _id: string;
  messageId: string;
  userId: string;
  emoji: string;
  count: number;
  createdAt: Date;
}

const MessageReactionSchema = new Schema<IMessageReactionDocument>(
  {
    _id: {
      type: String,
      required: true,
    },
    messageId: {
      type: String,
      required: true,
      ref: "Message",
    },
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    emoji: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      default: 1,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "message_reactions",
  },
);

MessageReactionSchema.index(
  { messageId: 1, userId: 1, emoji: 1 },
  { unique: true },
);
MessageReactionSchema.index({ messageId: 1, createdAt: -1 });
MessageReactionSchema.index({ userId: 1 });

export const MessageReactionModel = model<IMessageReactionDocument>(
  "MessageReaction",
  MessageReactionSchema,
);
