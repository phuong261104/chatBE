import { MessageCondDTO, MessageUpdateDTO } from '@modules/messages/model/dto';
import { Message } from '@modules/messages/model/model';
import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose
} from '@share/repository/repo-mongoose';
import { MessageModel } from './dto';

export class MongoMessageRepository extends BaseRepositoryMongoose<Message, MessageCondDTO, MessageUpdateDTO> {
  constructor() {
    super(new MongoMessageQueryRepository(), new MongoMessageCommandRepository());
  }
}

export class MongoMessageQueryRepository extends BaseQueryRepositoryMongoose<Message, MessageCondDTO> {
  constructor() {
    super(MessageModel, { createdAt: -1 });
  }
}

export class MongoMessageCommandRepository extends BaseCommandRepositoryMongoose<Message, MessageUpdateDTO> {
  constructor() {
    super(MessageModel);
  }
}
