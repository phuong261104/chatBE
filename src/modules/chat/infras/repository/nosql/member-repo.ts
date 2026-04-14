import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  ConversationMemberCursorResult,
} from "../../../interface";

import {
  ConversationMember,
} from "../../../model";
import {
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO,
} from "../../../model/dto";

import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose,
} from "@share/repository/repo-mongoose";

import {
  ConversationMemberModel,
} from "./schemas";

export class MongoConversationMemberQueryRepository extends BaseQueryRepositoryMongoose<
  ConversationMember,
  ConversationMemberCondDTO
> {
  constructor() {
    super(ConversationMemberModel, { updatedAt: -1 });
  }

  async listByUserIdCursor(
    userId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<ConversationMemberCursorResult> {
    const filter: any = {
      userId,
      leftAt: { $exists: false },
    };

    if (cursor) {
      const [cursorTs, ...cursorIdParts] = cursor.split("#");
      const cursorId = cursorIdParts.join("#");
      const cursorTime = new Date(cursorTs).getTime();

      filter.$or = [
        { updatedAt: { $lt: new Date(cursorTime) } },
        {
          updatedAt: new Date(cursorTime),
          conversationId: { $lt: cursorId },
        },
      ];
    }

    const allDocs = await ConversationMemberModel.find(filter)
      .sort({ updatedAt: -1, conversationId: 1 })
      .lean();

    const allMembers = allDocs.map((doc: any) => ({
      ...doc,
      id: doc._id,
      pinnedAt: doc.pinnedAt ? new Date(doc.pinnedAt) : null,
      leftAt: doc.leftAt ? new Date(doc.leftAt) : null,
      lastReadAt: doc.lastReadAt ? new Date(doc.lastReadAt) : null,
      muteUntil: doc.muteUntil ? new Date(doc.muteUntil) : null,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      joinedAt: doc.joinedAt ? new Date(doc.joinedAt) : new Date(),
    })) as ConversationMember[];

    const pinnedMembers = allMembers
      .filter((m) => m.pinned)
      .sort((a, b) => {
        const aTime = a.pinnedAt?.getTime() ?? 0;
        const bTime = b.pinnedAt?.getTime() ?? 0;
        return bTime - aTime;
      });

    const normalMembersRaw = allMembers.filter((m) => !m.pinned);

    let normalMembers = normalMembersRaw.slice(0, limit + 1);
    let hasMore = normalMembersRaw.length > limit;
    let nextCursor: string | undefined;

    if (hasMore) {
      normalMembers = normalMembers.slice(0, limit);
      const last = normalMembers[normalMembers.length - 1];
      nextCursor = `${last.updatedAt?.toISOString() ?? ""}#${last.conversationId}`;
    }

    return {
      pinnedMembers,
      normalMembers,
      nextCursor,
      hasMore,
    };
  }
}

export class MongoConversationMemberCommandRepository extends BaseCommandRepositoryMongoose<
  ConversationMember,
  ConversationMemberUpdateDTO
> {
  constructor() {
    super(ConversationMemberModel);
  }
}

export class MongoConversationMemberRepository
  extends BaseRepositoryMongoose<
    ConversationMember,
    ConversationMemberCondDTO,
    ConversationMemberUpdateDTO
  >
  implements
    IConversationMemberQueryRepository,
    IConversationMemberCommandRepository
{
  constructor() {
    super(
      new MongoConversationMemberQueryRepository(),
      new MongoConversationMemberCommandRepository(),
    );
  }

  async listByUserIdCursor(
    userId: string,
    cursor?: string,
    limit?: number,
  ): Promise<ConversationMemberCursorResult> {
    const queryRepo = (this as any).queryRepo as MongoConversationMemberQueryRepository;
    return await queryRepo.listByUserIdCursor(userId, cursor, limit);
  }
}
