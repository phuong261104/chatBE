import {
  IConversationQueryRepository,
  IConversationCommandRepository,
} from "../../../interface";

import {
  Conversation,
} from "../../../model";
import {
  ConversationCondDTO,
  ConversationUpdateDTO,
} from "../../../model/dto";

import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose,
} from "@share/repository/repo-mongoose";

import {
  ConversationModel,
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
