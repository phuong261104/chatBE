import { Schema, model } from 'mongoose';
import { ConversationType } from '@modules/conversations/model/model';
import { MessageType } from '@modules/messages/model/model';

interface IConversationDocument {
  _id: string;
  type: ConversationType;

  // Private conversation only
  pairKey?: string;

  // Group info
  name?: string;
  avatarUrl?: string;
  createdBy?: string;

  admins?: string[];
  membersCount: number;

  // Preview (denormalized)
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
      required: true
    },
    type: {
      type: String,
      enum: Object.values(ConversationType),
      required: true
    },
    pairKey: {
      type: String,
      required: false,
      unique: true,
      sparse: true
    },
    name: {
      type: String,
      required: false
    },
    avatarUrl: {
      type: String,
      required: false
    },
    createdBy: {
      type: String,
      required: false,
      ref: 'User'
    },
    admins: {
      type: [String],
      required: false,
      default: []
    },
    membersCount: {
      type: Number,
      required: true,
      default: 0
    },
    lastMessage: {
      messageId: {
        type: String,
        required: false
      },
      senderId: {
        type: String,
        required: false
      },
      type: {
        type: String,
        enum: Object.values(MessageType),
        required: false
      },
      textPreview: {
        type: String,
        required: false
      },
      createdAt: {
        type: Date,
        required: false
      }
    },
    lastMessageAt: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: true,
    collection: 'conversations'
  }
);

// Indexes
ConversationSchema.index({ pairKey: 1 });
ConversationSchema.index({ type: 1 });
ConversationSchema.index({ createdBy: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

export const ConversationModel = model<IConversationDocument>('Conversation', ConversationSchema);

export const modelName = 'Conversation';
