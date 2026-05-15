import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
} from "../interface";
import { ConversationMemberStatus } from "../model/model";
import { IPresenceUseCase } from "@modules/user/interface";

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
    private readonly presenceUseCase: IPresenceUseCase,
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

    return Promise.all(
      activeMembers.map(async (m) => {
        const presence = await this.presenceUseCase.getUserPresence(m.userId);
        return {
          userId: m.userId,
          isOnline: presence.isOnline,
          lastSeen: presence.lastSeen ? new Date(presence.lastSeen) : null,
        };
      }),
    );
  }
}
