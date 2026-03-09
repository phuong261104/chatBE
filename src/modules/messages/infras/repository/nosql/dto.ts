import { Schema, model } from 'mongoose';
import { MessageType, MediaType } from '@modules/messages/model/model';

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
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

const MessageSchema = new Schema<IMessageDocument>(
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
    senderId: {
      type: String,
      required: true,
      ref: 'User'
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      required: true
    },
    text: {
      type: String,
      required: false
    },
    media: [
      {
        url: {
          type: String,
          required: true
        },
        mediaType: {
          type: String,
          enum: Object.values(MediaType),
          required: true
        },
        name: {
          type: String,
          required: false
        },
        size: {
          type: Number,
          required: false
        },
        width: {
          type: Number,
          required: false
        },
        height: {
          type: Number,
          required: false
        }
      }
    ],
    editedAt: {
      type: Date,
      required: false
    },
    deletedAt: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'messages'
  }
);

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, deletedAt: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

export const MessageModel = model<IMessageDocument>('Message', MessageSchema);

export const modelName = 'Message';
