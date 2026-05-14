import { IQueryHandler } from "@share/interface";
import { IConversationQueryRepository, IConversationMemberQueryRepository, IUserQueryRepository, IMessageQueryRepository } from "../interface";
import { Conversation, ConversationMemberRole, ConversationMemberStatus, ConversationType, MessageStatus } from "../model/model";
import { GetConversationsQuery, ConversationWithMetadata } from "../model/dto";

export class GetConversationsQueryHandler implements IQueryHandler<GetConversationsQuery, ConversationWithMetadata[]> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
  ) {}

  async query(query: GetConversationsQuery): Promise<ConversationWithMetadata[]> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const members = await this.conversationMemberQueryRepo.list({ userId: query.userId }, { page, limit });

    const activeMembers = members.filter(
      (member) => member.status === ConversationMemberStatus.ACTIVE && !member.leftAt,
    );

    if (activeMembers.length === 0) {
      return [];
    }

    const conversationIds = activeMembers.map((member) => member.conversationId);

    const conversations: Conversation[] = await this.conversationQueryRepo.listByIds(conversationIds);

    const targetUserIds = new Set<string>();
    conversations.forEach((conv) => {
      if (conv.type === ConversationType.PRIVATE && conv.pairKey) {
        const ids = conv.pairKey.split("_");
        const targetId = ids.find((id) => id !== query.userId);
        if (targetId) targetUserIds.add(targetId);
      }
    });

    const targetUsers = targetUserIds.size > 0 ? await this.userQueryRepo.findByIds(Array.from(targetUserIds)) : [];
    const targetUserMap = new Map(targetUsers.map((u) => [u.id, u]));

    const memberMap = new Map(activeMembers.map((m) => [m.conversationId, m]));

    const result: ConversationWithMetadata[] = await Promise.all(
      conversations.map(async (conv) => {
        const member = memberMap.get(conv.id);

        let name = conv.name || "";
        let avatarUrl = conv.avatarUrl || "";

        if (conv.type === ConversationType.PRIVATE && conv.pairKey) {
          const ids = conv.pairKey.split("_");
          const targetId = ids.find((id) => id !== query.userId);
          const targetUser = targetId ? targetUserMap.get(targetId) : null;
          if (targetUser) {
            name = targetUser.displayName || name;
            avatarUrl = targetUser.avatarUrl || avatarUrl;
          }
        }

        let lastMessageStatus: "sent" | "delivered" | "read" = "sent";
        if (conv.lastMessage && conv.lastMessage.senderId === query.userId && conv.type === ConversationType.PRIVATE) {
          try {
            const membersInConv = await this.conversationMemberQueryRepo.list(
              { conversationId: conv.id },
              { page: 1, limit: 10 },
            );
            const otherMember = membersInConv.find((m) => m.userId !== query.userId);
            if (otherMember) {
              if (
                otherMember.lastSeenMessageId === conv.lastMessage.messageId ||
                (otherMember.lastReadAt && otherMember.lastReadAt >= conv.lastMessage.createdAt)
              ) {
                lastMessageStatus = "read";
              } else if (otherMember.lastDeliveredMessageId === conv.lastMessage.messageId) {
                lastMessageStatus = "delivered";
              }
            }
          } catch (e) {
            // ignore
          }
        }

        let lastMessageTimeFormatted = "";
        if (conv.lastMessageAt) {
          const d = conv.lastMessageAt;
          const now = new Date();
          const isSameDay =
            d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          if (isSameDay) {
            lastMessageTimeFormatted = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
          } else {
            lastMessageTimeFormatted = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
          }
        }

        const visibleLast = await this.resolveVisibleLastMessage(conv, query.userId);
        const activityAt =
          member?.lastActivityAt ||
          visibleLast.lastMessageAt ||
          conv.lastMessageAt ||
          conv.updatedAt ||
          conv.createdAt;

        return {
          ...conv,
          lastMessage: visibleLast.lastMessage,
          lastMessageAt: visibleLast.lastMessageAt,
          activityAt,
          name,
          avatarUrl,
          unreadCount: member?.unreadCount || 0,
          role: member?.role || ConversationMemberRole.MEMBER,
          lastMessageStatus,
          lastMessageTimeFormatted,
        };
      }),
    );

    result.sort((a, b) => {
      const timeA = (a as any).activityAt?.getTime?.() || a.lastMessageAt?.getTime() || a.createdAt.getTime();
      const timeB = (b as any).activityAt?.getTime?.() || b.lastMessageAt?.getTime() || b.createdAt.getTime();
      return timeB - timeA;
    });

    return result;
  }

  private async resolveVisibleLastMessage(
    conv: Conversation,
    userId: string,
  ): Promise<{ lastMessage: Conversation["lastMessage"]; lastMessageAt: Date | undefined }> {
    if (!conv.lastMessage) {
      return { lastMessage: conv.lastMessage, lastMessageAt: conv.lastMessageAt || undefined };
    }

    const message = await this.messageQueryRepo.get(conv.lastMessage.messageId);
    if (!message) {
      return { lastMessage: conv.lastMessage, lastMessageAt: conv.lastMessageAt || undefined };
    }

    if (message.deletedForUserIds?.includes(userId)) {
      const visible = await this.messageQueryRepo.listWithCursor(conv.id, undefined, 1, userId);
      const latest = visible[0];
      if (!latest) return { lastMessage: undefined, lastMessageAt: undefined };
      return {
        lastMessage: {
          messageId: latest.id,
          senderId: latest.senderId,
          type: latest.type,
          textPreview: latest.messageStatus === MessageStatus.REVOKED
            ? "Tin nhắn đã được thu hồi"
            : latest.text,
          createdAt: latest.createdAt,
        },
        lastMessageAt: latest.createdAt,
      };
    }

    if (message.messageStatus === MessageStatus.REVOKED || message.deletedAt) {
      return {
        lastMessage: {
          ...conv.lastMessage,
          textPreview: "Tin nhắn đã được thu hồi",
        },
        lastMessageAt: conv.lastMessageAt || message.createdAt,
      };
    }

    return { lastMessage: conv.lastMessage, lastMessageAt: conv.lastMessageAt || undefined };
  }
}
