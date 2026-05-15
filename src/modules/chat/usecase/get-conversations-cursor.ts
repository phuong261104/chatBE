import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationMemberQueryRepository,
  IUserQueryRepository,
  IMessageQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageStatus,
} from "../model/model";
import {
  GetConversationsCursorQuery,
  ConversationCursorResult,
} from "../model/dto";

export class GetConversationsCursorQueryHandler implements IQueryHandler<
  GetConversationsCursorQuery,
  ConversationCursorResult
> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
  ) {}

  async query(
    query: GetConversationsCursorQuery,
  ): Promise<ConversationCursorResult> {
    const limit = query.limit || 20;
    const isFirstLoad = !query.cursor;

    let pinnedMembers: any[];
    let normalMembers: any[];
    let nextCursor: string | undefined;
    let hasMore: boolean;

    try {
      const result = await this.conversationMemberQueryRepo.listByUserIdCursor(
        query.userId,
        query.cursor,
        limit,
      );
      pinnedMembers = result.pinnedMembers.filter(
        (member) => member.status === ConversationMemberStatus.ACTIVE && !member.leftAt,
      );
      normalMembers = result.normalMembers.filter(
        (member) => member.status === ConversationMemberStatus.ACTIVE && !member.leftAt,
      );
      nextCursor = result.nextCursor;
      hasMore = result.hasMore;
    } catch (e) {
      if (query.cursor) {
        throw AppError.from(
          new Error("Invalid cursor. Please restart from first page."),
          400,
        );
      }
      throw e;
    }

    const pinned = isFirstLoad
      ? await this.enrichConversations(query.userId, pinnedMembers, true)
      : null;
    const data = await this.enrichConversations(
      query.userId,
      normalMembers,
      false,
    );

    return {
      pinned,
      data,
      nextCursor,
      hasMore,
    };
  }

  private async enrichConversations(
    userId: string,
    members: any[],
    includePinnedAt: boolean,
  ): Promise<any[]> {
    if (members.length === 0) return [];

    const memberMap = new Map(members.map((m) => [m.conversationId, m]));

    const conversations: any[] = [];
    for (const member of members) {
      const conv = await this.conversationQueryRepo.get(member.conversationId);
      if (conv) {
        conversations.push(conv);
      }
    }

    const targetUserIds = new Set<string>();
    conversations.forEach((conv) => {
      if (conv.type === ConversationType.PRIVATE && conv.pairKey) {
        const ids = conv.pairKey.split("_");
        const targetId = ids.find((id: string) => id !== userId);
        if (targetId) targetUserIds.add(targetId);
      }
    });

    const targetUsers =
      targetUserIds.size > 0
        ? await this.userQueryRepo.findByIds(Array.from(targetUserIds))
        : [];
    const targetUserMap = new Map(targetUsers.map((u) => [u.id, u]));

    return Promise.all(
      conversations.map(async (conv) => {
        const member = memberMap.get(conv.id);

        let name = conv.name || "";
        let avatarUrl = conv.avatarUrl || "";

        if (conv.type === ConversationType.PRIVATE && conv.pairKey) {
          const ids = conv.pairKey.split("_");
          const targetId = ids.find((id: string) => id !== userId);
          const targetUser = targetId ? targetUserMap.get(targetId) : null;
          if (targetUser) {
            name = targetUser.displayName || name;
            avatarUrl = targetUser.avatarUrl || avatarUrl;
          }
        }

        let lastMessageStatus: "sent" | "delivered" | "read" = "sent";
        if (
          conv.lastMessage &&
          conv.lastMessage.senderId === userId &&
          conv.type === ConversationType.PRIVATE
        ) {
          try {
            const membersInConvArr = await this.conversationMemberQueryRepo
              .list({ conversationId: conv.id }, { page: 1, limit: 10 });
            const otherMember = membersInConvArr.find(
              (m) => m.userId !== userId,
            );
            if (otherMember) {
              if (
                otherMember.lastSeenMessageId === conv.lastMessage!.messageId ||
                (otherMember.lastReadAt &&
                  otherMember.lastReadAt >= conv.lastMessage!.createdAt)
              ) {
                lastMessageStatus = "read";
              } else if (
                otherMember.lastDeliveredMessageId ===
                conv.lastMessage!.messageId
              ) {
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
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();
          if (isSameDay) {
            lastMessageTimeFormatted = d.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            });
          } else {
            lastMessageTimeFormatted = d.toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
            });
          }
        }

        const visibleLast = await this.resolveVisibleLastMessage(conv, userId, member?.hiddenAt);
        const activityAt =
          member?.lastActivityAt ||
          visibleLast.lastMessageAt ||
          conv.lastMessageAt ||
          conv.updatedAt ||
          conv.createdAt;

        const enriched: any = {
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

        if (includePinnedAt && member?.pinnedAt) {
          enriched.pinnedAt = member.pinnedAt;
        }

        return enriched;
      }),
    );
  }

  private async resolveVisibleLastMessage(
    conv: Conversation,
    userId: string,
    hiddenAt?: Date,
  ): Promise<{ lastMessage: Conversation["lastMessage"]; lastMessageAt: Date | undefined }> {
    if (!conv.lastMessage) {
      return { lastMessage: conv.lastMessage, lastMessageAt: conv.lastMessageAt || undefined };
    }

    const message = await this.messageQueryRepo.get(conv.lastMessage.messageId);
    if (!message) {
      return { lastMessage: conv.lastMessage, lastMessageAt: conv.lastMessageAt || undefined };
    }

    if (
      (hiddenAt && message.createdAt <= hiddenAt) ||
      message.deletedForUserIds?.includes(userId)
    ) {
      const latest = await this.findLatestVisibleMessage(conv.id, userId, hiddenAt);
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

  private async findLatestVisibleMessage(
    conversationId: string,
    userId: string,
    hiddenAt?: Date,
  ): Promise<Message | undefined> {
    let cursor: string | undefined;

    while (true) {
      const messages = await this.messageQueryRepo.listWithCursor(
        conversationId,
        cursor,
        20,
        userId,
      );
      if (messages.length === 0) return undefined;

      const latest = messages.find((msg) => !hiddenAt || msg.createdAt > hiddenAt);
      if (latest) return latest;

      if (hiddenAt && messages.some((msg) => msg.createdAt <= hiddenAt)) {
        return undefined;
      }

      cursor = messages[messages.length - 1].id;
    }
  }
}
