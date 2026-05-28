import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationCommandRepository,
  IConversationQueryRepository,
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
  IUserQueryRepository,
  IMessageQueryRepository,
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
import {
  GetConversationsCursorQuery,
  ConversationCursorResult,
} from "../model/dto";
import {
  compareConversationListItems,
  ensureSelfConversation,
  isSelfConversation,
  normalizeConversationListItem,
} from "./conversation-listing";

export class GetConversationsCursorQueryHandler implements IQueryHandler<
  GetConversationsCursorQuery,
  ConversationCursorResult
> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async query(
    query: GetConversationsCursorQuery,
  ): Promise<ConversationCursorResult> {
    const limit = query.limit || 20;
    const isFirstLoad = !query.cursor;

    await ensureSelfConversation(
      query.userId,
      this.conversationQueryRepo,
      this.conversationCommandRepo,
      this.conversationMemberQueryRepo,
      this.conversationMemberCommandRepo,
    );

    const members = await this.listActiveMembersForUser(query.userId);
    const enriched = await this.enrichConversations(query.userId, members);
    enriched.sort(compareConversationListItems(query.userId));

    const pinnedConversations = enriched.filter((conversation) => !!conversation.pinned);
    const normalConversations = enriched.filter((conversation) => !conversation.pinned);
    const startIndex = this.getCursorStartIndex(normalConversations, query.cursor);
    const page = normalConversations.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < normalConversations.length;
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : undefined;

    return {
      pinned: isFirstLoad ? pinnedConversations : null,
      data: page,
      nextCursor,
      hasMore,
    };
  }

  private async enrichConversations(
    userId: string,
    members: any[],
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
      if (conv.type === ConversationType.PRIVATE && conv.pairKey && !isSelfConversation(conv, userId)) {
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

    // Batch load all members for nickname/wallpaper population
    const allMembersMap = new Map<string, any[]>();
    for (const conv of conversations) {
      const membersInConv = await this.conversationMemberQueryRepo
        .list({ conversationId: conv.id }, { page: 1, limit: 1000 });
      allMembersMap.set(conv.id, membersInConv.filter(
        (m) => m.status === ConversationMemberStatus.ACTIVE && !m.leftAt,
      ));
    }

    return Promise.all(
      conversations.map(async (conv) => {
        const member = memberMap.get(conv.id);
        const allMembersInConv = allMembersMap.get(conv.id) || [];

        let name = conv.name || "";
        let avatarUrl = conv.avatarUrl || "";

        if (isSelfConversation(conv, userId)) {
          name = "My Document";
          avatarUrl = "";
        } else if (conv.type === ConversationType.PRIVATE && conv.pairKey) {
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
          const otherMember = allMembersInConv.find(
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
        const activityAt = this.resolveActivityAt(
          member?.lastActivityAt,
          visibleLast.lastMessageAt,
          conv.lastMessageAt,
          conv.updatedAt,
          conv.createdAt,
        );

        // Build nicknames map from members
        const nicknamesByUserId: Record<string, string> = {};
        for (const m of allMembersInConv) {
          if (m.userId && typeof m.nickname === "string" && m.nickname.length > 0) {
            nicknamesByUserId[m.userId] = m.nickname;
          }
        }

        // Get wallpaper from current user's member record
        const wallpaperUrl = member?.wallpaper || null;

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
          nicknamesByUserId,
          wallpaperUrl,
        }, userId);
      }),
    );
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

  private getCursorStartIndex(conversations: Array<{ id: string }>, cursor?: string): number {
    if (!cursor) return 0;

    const cursorIndex = conversations.findIndex((conversation) => conversation.id === cursor);
    if (cursorIndex < 0) {
      throw AppError.from(
        new Error("Invalid cursor. Please restart from first page."),
        400,
      );
    }

    return cursorIndex + 1;
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
