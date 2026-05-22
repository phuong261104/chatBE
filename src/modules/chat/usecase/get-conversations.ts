import { IQueryHandler } from "@share/interface";
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
  IMessageQueryRepository,
  IUserQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageStatus,
} from "../model/model";
import { GetConversationsQuery, ConversationWithMetadata } from "../model/dto";
import {
  compareConversationListItems,
  ensureSelfConversation,
  isSelfConversation,
  normalizeConversationListItem,
} from "./conversation-listing";

export class GetConversationsQueryHandler implements IQueryHandler<GetConversationsQuery, ConversationWithMetadata[]> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async query(query: GetConversationsQuery): Promise<ConversationWithMetadata[]> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    await ensureSelfConversation(
      query.userId,
      this.conversationQueryRepo,
      this.conversationCommandRepo,
      this.conversationMemberQueryRepo,
      this.conversationMemberCommandRepo,
    );

    const activeMembers = await this.listActiveMembersForUser(query.userId);

    if (activeMembers.length === 0) {
      return [];
    }

    const conversationIds = activeMembers.map((member) => member.conversationId);

    const conversations: Conversation[] = await this.conversationQueryRepo.listByIds(conversationIds);

    const targetUserIds = new Set<string>();
    conversations.forEach((conv) => {
      if (conv.type === ConversationType.PRIVATE && conv.pairKey && !isSelfConversation(conv, query.userId)) {
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

        if (isSelfConversation(conv, query.userId)) {
          name = "My Document";
          avatarUrl = "";
        } else if (conv.type === ConversationType.PRIVATE && conv.pairKey) {
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

        const visibleLast = await this.resolveVisibleLastMessage(conv, query.userId, member?.hiddenAt);
        const activityAt = this.resolveActivityAt(
          member?.lastActivityAt,
          visibleLast.lastMessageAt,
          conv.lastMessageAt,
          conv.updatedAt,
          conv.createdAt,
        );

        return normalizeConversationListItem({
          ...conv,
          lastMessage: visibleLast.lastMessage,
          lastMessageAt: visibleLast.lastMessageAt,
          activityAt,
          name,
          avatarUrl,
          unreadCount: member?.unreadCount || 0,
          role: member?.role || ConversationMemberRole.MEMBER,
          pinned: !!member?.pinned,
          isPinned: !!member?.pinned,
          pinnedAt: member?.pinnedAt || undefined,
          archived: !!member?.archived,
          muteUntil: member?.muteUntil || undefined,
          lastMessageStatus,
          lastMessageTimeFormatted,
        }, query.userId);
      }),
    );

    result.sort(compareConversationListItems(query.userId));

    const start = (page - 1) * limit;
    return result.slice(start, start + limit);
  }

  private async listActiveMembersForUser(userId: string): Promise<ConversationMember[]> {
    const repoWithActiveLookup = this.conversationMemberQueryRepo as any;
    const members: ConversationMember[] = typeof repoWithActiveLookup.findActiveByUserId === "function"
      ? await repoWithActiveLookup.findActiveByUserId(userId)
      : await this.conversationMemberQueryRepo.list({ userId }, { page: 1, limit: 1000 });

    return members.filter(
      (member) => member.status === ConversationMemberStatus.ACTIVE && !member.leftAt,
    );
  }

  private resolveActivityAt(
    memberActivityAt: Date | undefined | null,
    visibleLastMessageAt: Date | undefined | null,
    conversationLastMessageAt: Date | undefined | null,
    updatedAt: Date | undefined | null,
    createdAt: Date,
  ): Date {
    const messageActivity = [memberActivityAt, visibleLastMessageAt, conversationLastMessageAt]
      .filter((date): date is Date => !!date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return messageActivity || updatedAt || createdAt;
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
