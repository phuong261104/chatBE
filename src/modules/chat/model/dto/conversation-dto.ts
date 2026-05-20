import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";
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
  settings: z
    .object({
      allowSendLink: z.boolean().optional(),
      requireApproval: z.boolean().optional(),
      allowMemberInvite: z.boolean().optional(),
      whoCanSendMessages: z.enum(["all", "admins"]).optional(),
      whoCanAddMembers: z.enum(["all", "admins"]).optional(),
      utilityPermissions: z.object({
        poll: z.enum(["all", "admins"]).optional(),
        reminder: z.enum(["all", "admins"]).optional(),
        note: z.enum(["all", "admins"]).optional(),
      }).optional(),
    })
    .optional(),
  lastMessage: LastMessageSchema.optional(),
  lastMessageAt: z.date().optional(),
});

export type ConversationUpdateDTO = z.infer<typeof ConversationUpdateDTOSchema>;

export const getOrCreatePrivateConversationDTOSchema = z.object({
  currentUserId: uuidV7("Invalid current user ID"),
  targetUserId: uuidV7("Invalid target user ID"),
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

export interface GetConversationsCursorQuery {
  userId: string;
  cursor?: string;
  limit?: number;
}

export type ConversationWithMetadata = Conversation & {
  name: string;
  avatarUrl: string;
  unreadCount: number;
  role: any;
  lastMessageStatus?: "sent" | "delivered" | "read";
  lastMessageTimeFormatted?: string;
};

export type ConversationCursorResult = {
  pinned: Array<
    Conversation & {
      unreadCount: number;
      role: any;
      pinnedAt?: Date;
      name: string;
      avatarUrl: string;
      lastMessageStatus?: string;
      lastMessageTimeFormatted?: string;
    }
  > | null;
  data: Array<
    Conversation & {
      unreadCount: number;
      role: any;
      name: string;
      avatarUrl: string;
      lastMessageStatus?: string;
      lastMessageTimeFormatted?: string;
    }
  >;
  nextCursor?: string;
  hasMore: boolean;
};

export interface GetConversationDetailQuery {
  conversationId: string;
  userId: string;
}

export const getConversationDetailDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV7("Invalid user ID"),
});

export type GetConversationDetailDTO = z.infer<typeof getConversationDetailDTOSchema>;

export interface ConversationDetail {
  conversation: Conversation;
  members: ConversationMember[];
  currentUserRole: any;
}
