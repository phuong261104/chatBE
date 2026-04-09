import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
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
