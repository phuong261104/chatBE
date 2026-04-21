import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import { Conversation, ConversationType } from "../model/model";
import { GetSharedConversationsDTO } from "../model/dto/shared-conversations-dto";

export class GetSharedConversationsQueryHandler
  implements IQueryHandler<GetSharedConversationsDTO, Conversation[]>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: GetSharedConversationsDTO): Promise<Conversation[]> {
    const { userId, currentUserId } = query;

    if (userId !== currentUserId) {
      throw AppError.from(new Error("Unauthorized"), 403);
    }

    const [currentUserConvs, targetUserConvs] = await Promise.all([
      this.getUserConversationIds(currentUserId),
      this.getUserConversationIds(userId),
    ]);

    const currentSet = new Set(currentUserConvs);
    const sharedConversationIds = targetUserConvs.filter((id) => currentSet.has(id));

    if (sharedConversationIds.length === 0) {
      return [];
    }

    const sharedConversations = await Promise.all(
      sharedConversationIds.map((id) => this.conversationQueryRepo.get(id))
    );

    return sharedConversations.filter((c): c is Conversation => c !== null);
  }

  private async getUserConversationIds(userId: string): Promise<string[]> {
    const result = await this.conversationMemberQueryRepo.listByUserIdCursor(userId, undefined, 1000);
    return [...result.pinnedMembers, ...result.normalMembers].map((m) => m.conversationId);
  }
}
