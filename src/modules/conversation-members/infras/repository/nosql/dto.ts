import { Schema, model } from 'mongoose';
import { ConversationMemberRole } from '@modules/conversation-members/model/model';

interface IConversationMemberDocument {
  _id: string;
  conversationId: string;
  userId: string;
  role: ConversationMemberRole;

  joinedAt: Date;
  leftAt?: Date;

  // Inbox state
  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: Date;

  muteUntil?: Date;
  pinned: boolean;
  archived: boolean;

  updatedAt: Date;
}

const ConversationMemberSchema = new Schema<IConversationMemberDocument>(
  {
    _id: {
      type: String,
      required: true
    },
    conversationId: {
      type: String,
      required: true,
      ref: 'Conversation'
    },
    userId: {
      type: String,
      required: true,
      ref: 'User'
    },
    role: {
      type: String,
      enum: Object.values(ConversationMemberRole),
      required: true,
      default: ConversationMemberRole.MEMBER
    },
    joinedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    leftAt: {
      type: Date,
      required: false
    },
    unreadCount: {
      type: Number,
      required: true,
      default: 0
    },
    lastReadMessageId: {
      type: String,
      required: false
    },
    lastReadAt: {
      type: Date,
      required: false
    },
    muteUntil: {
      type: Date,
      required: false
    },
    pinned: {
      type: Boolean,
      required: true,
      default: false
    },
    archived: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: 'conversation_members'
  }
);

// Indexes
ConversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
ConversationMemberSchema.index({ userId: 1, archived: 1, pinned: -1, updatedAt: -1 });
ConversationMemberSchema.index({ conversationId: 1, leftAt: 1 });

export const ConversationMemberModel = model<IConversationMemberDocument>(
  'ConversationMember',
  ConversationMemberSchema
);

export const modelName = 'ConversationMember';
