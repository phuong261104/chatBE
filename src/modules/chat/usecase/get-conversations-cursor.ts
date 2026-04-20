import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationMemberQueryRepository,
  IUserQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMemberRole,
  ConversationType,
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
      pinnedMembers = result.pinnedMembers;
      normalMembers = result.normalMembers;
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

        const enriched: any = {
          ...conv,
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
}
