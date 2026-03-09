import { ConversationCondDTO, ConversationUpdateDTO } from '@modules/conversations/model/dto';
import { Conversation } from '@modules/conversations/model/model';
import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose
} from '@share/repository/repo-mongoose';
import { ConversationModel } from './dto';

export class MongoConversationRepository extends BaseRepositoryMongoose<
  Conversation,
  ConversationCondDTO,
  ConversationUpdateDTO
> {
  constructor() {
    super(new MongoConversationQueryRepository(), new MongoConversationCommandRepository());
  }
}

export class MongoConversationQueryRepository extends BaseQueryRepositoryMongoose<Conversation, ConversationCondDTO> {
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
