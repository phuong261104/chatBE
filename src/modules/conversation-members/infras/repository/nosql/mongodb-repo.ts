import { ConversationMemberCondDTO, ConversationMemberUpdateDTO } from '@modules/conversation-members/model/dto';
import { ConversationMember } from '@modules/conversation-members/model/model';
import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose
} from '@share/repository/repo-mongoose';
import { ConversationMemberModel } from './dto';

export class MongoConversationMemberRepository extends BaseRepositoryMongoose<
  ConversationMember,
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO
> {
  constructor() {
    super(new MongoConversationMemberQueryRepository(), new MongoConversationMemberCommandRepository());
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
