import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageQueryRepository,
  IMessageCommandRepository,
} from "../../../interface";

import {
  Conversation,
  ConversationMember,
  Message,
} from "../../../model/model";
import {
  ConversationCondDTO,
  ConversationUpdateDTO,
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO,
  MessageCondDTO,
  MessageUpdateDTO,
} from "../../../model/dto";

import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose,
} from "@share/repository/repo-mongoose";
import { PagingDTO } from "@share/model/paging";

import {
  ConversationModel,
  ConversationMemberModel,
  MessageModel,
} from "./schemas";

export class MongoConversationQueryRepository extends BaseQueryRepositoryMongoose<
  Conversation,
  ConversationCondDTO
> {
  constructor() {
    super(ConversationModel, { lastMessageAt: -1 });
  }
}

export class MongoConversationCommandRepository extends BaseCommandRepositoryMongoose<
  Conversation,
  ConversationUpdateDTO
> {
  constructor() {
    super(ConversationModel);
  }
}

export class MongoConversationRepository
  extends BaseRepositoryMongoose<
    Conversation,
    ConversationCondDTO,
    ConversationUpdateDTO
  >
  implements IConversationQueryRepository, IConversationCommandRepository
{
  constructor() {
    super(
      new MongoConversationQueryRepository(),
      new MongoConversationCommandRepository(),
    );
  }
}

export class MongoConversationMemberQueryRepository extends BaseQueryRepositoryMongoose<
  ConversationMember,
  ConversationMemberCondDTO
> {
  constructor() {
    super(ConversationMemberModel, { updatedAt: -1 });
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
}

export class MongoMessageQueryRepository extends BaseQueryRepositoryMongoose<
  Message,
  MessageCondDTO
> {
  constructor() {
    super(MessageModel, { createdAt: -1 });
  }
}

export class MongoMessageCommandRepository extends BaseCommandRepositoryMongoose<
  Message,
  MessageUpdateDTO
> {
  constructor() {
    super(MessageModel);
  }
}

export class MongoMessageRepository
  extends BaseRepositoryMongoose<Message, MessageCondDTO, MessageUpdateDTO>
  implements IMessageQueryRepository, IMessageCommandRepository
{
  constructor() {
    super(
      new MongoMessageQueryRepository(),
      new MongoMessageCommandRepository(),
    );
  }

  async listWithCursor(
    conversationId: string,
    cursor: string | undefined,
    limit: number,
    viewerUserId?: string,
  ): Promise<Message[]> {
    const cond: any = {
      conversationId,
    };

    if (viewerUserId) {
      cond.deletedForUserIds = { $ne: viewerUserId };
    }

    if (cursor) {
      const cursorMessage = await this.get(cursor);
      if (cursorMessage) {
        cond.createdAt = { $lt: cursorMessage.createdAt };
      }
    }

    const rows = await MessageModel.find(cond)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return rows.map((row) => {
      const { _id, __v, ...rest } = row as any;
      return {
        ...rest,
        id: String(_id),
      } as Message;
    });
  }
}
