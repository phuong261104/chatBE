import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
} from "../interface";
import { ConversationMemberStatus } from "../model/model";

interface OnlineMemberResult {
  userId: string;
  isOnline: boolean;
  lastSeen: Date | null;
}

export class GetConversationOnlineMembersQueryHandler
  implements IQueryHandler<{ conversationId: string; userId: string }, OnlineMemberResult[]>
{
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: { conversationId: string; userId: string }): Promise<OnlineMemberResult[]> {
    const { conversationId, userId } = query;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const allMembers = await this.conversationMemberQueryRepo.listByConversationId(conversationId);
    const activeMembers = allMembers.filter(
      (m) => m.status === ConversationMemberStatus.ACTIVE && !m.leftAt
    );

    return activeMembers.map((m) => ({
      userId: m.userId,
      isOnline: false,
      lastSeen: m.lastReadAt || m.joinedAt,
    }));
  }
}
