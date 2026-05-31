import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IGroupReminderQueryRepository,
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
  IMessageReactionQueryRepository,
  IPollQueryRepository,
  IUserQueryRepository,
} from "../interface";
import { ConversationMemberStatus, Message } from "../model/model";
import { loadMessagesDTOSchema, LoadMessagesQuery, LoadMessagesResult } from "../model/dto";
import { hydrateUtilityMessages } from "./hydrate-utility-messages";
import { isMessageAfterCutoff, latestVisibilityCutoff } from "./conversation-visibility";

export class LoadMessagesQueryHandler implements IQueryHandler<LoadMessagesQuery, LoadMessagesResult> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageReactionQueryRepo: IMessageReactionQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly reminderQueryRepo: IGroupReminderQueryRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
  ) {}

  async query(query: LoadMessagesQuery): Promise<LoadMessagesResult> {
    const {
      success,
      data: validatedInput,
      error,
    } = loadMessagesDTOSchema.safeParse({
      conversationId: query.conversationId,
      userId: query.userId,
      cursor: query.cursor,
      limit: query.limit,
    });

    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail("validationErrors", error.errors);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("Unauthorized: You are not a member of this conversation"), 403);
    }

    const messages = await this.messageQueryRepo.listWithCursor(
      validatedInput.conversationId,
      validatedInput.cursor,
      validatedInput.limit + 1,
      validatedInput.userId,
    );

    const cutoff = latestVisibilityCutoff(member);
    const historyVisibleFrom = member.historyVisibleFrom;
    const visibleMessages = messages.filter((msg) => {
      if (msg.deletedForUserIds?.includes(validatedInput.userId)) return false;
      if (!isMessageAfterCutoff(msg, cutoff)) return false;
      if (historyVisibleFrom && msg.createdAt < historyVisibleFrom) return false;
      return true;
    });

    const hasMore = visibleMessages.length > validatedInput.limit;
    const returnMessages = hasMore
      ? visibleMessages.slice(0, validatedInput.limit)
      : visibleMessages;

    // Lấy reactions cho các tin nhắn được trả về
    await Promise.all(
      returnMessages.map(async (msg) => {
        const reactions = await this.messageReactionQueryRepo.findByMessageId(msg.id);
        if (reactions && reactions.length > 0) {
          // Nhóm lại theo emoji để trả về structure mà frontend cần
          const grouped: Record<string, { emoji: string; count: number; users: any[] }> = {};

          // Nạp user data
          await Promise.all(
            reactions.map(async (r) => {
              if (!r.user || !r.user.avatarUrl) {
                const user = await this.userQueryRepo.get(r.userId);
                if (user) {
                  r.user = {
                    id: user.id,
                    avatarUrl: user.avatarUrl || undefined,
                    displayName: user.displayName || "Unknown User",
                  };
                }
              }
            }),
          );

          for (const r of reactions) {
            if (!grouped[r.emoji]) {
              grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
            }
            grouped[r.emoji].count += r.count;
            // Ở Frontend dùng u._id || u.id nên ta ném vô id
            grouped[r.emoji].users.push({
              id: r.userId,
              _id: r.userId,
              avatarUrl: r.user?.avatarUrl || undefined,
              displayName: r.user?.displayName || "Unknown User",
            });
          }
          msg.reactions = Object.values(grouped);
        } else {
          msg.reactions = [];
        }
      }),
    );

    const nextCursor = hasMore && returnMessages.length > 0 ? returnMessages[returnMessages.length - 1].id : "";

    const conversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    await hydrateUtilityMessages(returnMessages, {
      pollQueryRepo: this.pollQueryRepo,
      reminderQueryRepo: this.reminderQueryRepo,
      viewer: member,
      conversation,
    });

    const allMembers = await this.conversationMemberQueryRepo.list(
      { conversationId: validatedInput.conversationId },
      { page: 1, limit: 1000 }
    );

    const memberSeenMap: Record<string, string> = {};
    for (const m of allMembers) {
      if (
        m.userId !== validatedInput.userId &&
        m.status === ConversationMemberStatus.ACTIVE &&
        !m.leftAt &&
        m.lastSeenMessageId
      ) {
        memberSeenMap[m.userId] = m.lastSeenMessageId;
      }
    }

    return {
      messages: returnMessages,
      nextCursor,
      hasMore,
      memberSeenMap,
    };
  }
}
