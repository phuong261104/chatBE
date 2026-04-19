import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
} from "../interface";
import { Message } from "../model/model";
import {
  loadMessagesDTOSchema,
  LoadMessagesQuery,
  LoadMessagesResult,
} from "../model/dto";

export class LoadMessagesQueryHandler implements IQueryHandler<
  LoadMessagesQuery,
  LoadMessagesResult
> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
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
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.userId,
    });

    if (!member || member.leftAt) {
      throw AppError.from(
        new Error("Unauthorized: You are not a member of this conversation"),
        403,
      );
    }

    const messages = await this.messageQueryRepo.listWithCursor(
      validatedInput.conversationId,
      validatedInput.cursor,
      validatedInput.limit + 1,
      validatedInput.userId,
    );

    const hasMore = messages.length > validatedInput.limit;
    const returnMessages = hasMore
      ? messages.slice(0, validatedInput.limit)
      : messages;

    const nextCursor =
      hasMore && returnMessages.length > 0
        ? returnMessages[returnMessages.length - 1].id
        : "";

    const allMembers = await this.conversationMemberQueryRepo.listByConversationId(
      validatedInput.conversationId,
    );

    const memberSeenMap: Record<string, string> = {};
    for (const m of allMembers) {
      if (m.userId !== validatedInput.userId && m.lastSeenMessageId) {
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
