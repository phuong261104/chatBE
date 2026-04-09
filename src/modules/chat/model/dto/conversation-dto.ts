import { z } from "zod";
import {
  ConversationType,
  LastMessageSchema,
  Conversation,
  ConversationMember,
} from "../model";

export const ConversationCondDTOSchema = z.object({
  type: z.nativeEnum(ConversationType).optional(),
  pairKey: z.string().optional(),
  createdBy: z.string().optional(),
});

export type ConversationCondDTO = z.infer<typeof ConversationCondDTOSchema>;

export const ConversationUpdateDTOSchema = z.object({
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  ownerId: z.string().optional(),
  admins: z.array(z.string()).optional(),
  membersCount: z.number().optional(),
  settings: z.object({
    allowSendLink: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    allowMemberInvite: z.boolean().optional(),
  }).optional(),
  lastMessage: LastMessageSchema.optional(),
  lastMessageAt: z.date().optional(),
});

export type ConversationUpdateDTO = z.infer<typeof ConversationUpdateDTOSchema>;

export const getOrCreatePrivateConversationDTOSchema = z.object({
  currentUserId: z.string().uuid("Invalid current user ID"),
  targetUserId: z.string().uuid("Invalid target user ID"),
});

export type GetOrCreatePrivateConversationDTO = z.infer<
  typeof getOrCreatePrivateConversationDTOSchema
>;

export interface GetOrCreatePrivateConversationCommand {
  currentUserId: string;
  targetUserId: string;
}

export interface CreateGroupResult {
  conversation: Conversation;
  members: ConversationMember[];
  systemMessage: any;
}

export interface GetConversationsQuery {
  userId: string;
  page?: number;
  limit?: number;
}

export type ConversationWithMetadata = Conversation & {
  unreadCount: number;
  role: any;
};

export interface GetConversationDetailQuery {
  conversationId: string;
  userId: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  members: ConversationMember[];
  currentUserRole: any;
}
