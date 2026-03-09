import { UserCondDTO, UserUpdateDTO } from '@/modules/user/model/dto';
import { User } from '@modules/user/model/model';
import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose
} from '@share/repository/repo-mongoose';
import { UserModel } from './dto';

export class MongoUserRepository extends BaseRepositoryMongoose<User, UserCondDTO, UserUpdateDTO> {
  constructor() {
    super(new MongoUserQueryRepository(), new MongoUserCommandRepository());
  }
}

export class MongoUserQueryRepository extends BaseQueryRepositoryMongoose<User, UserCondDTO> {
  constructor() {
    super(UserModel, { _id: -1 });
  }
}

export class MongoUserCommandRepository extends BaseCommandRepositoryMongoose<User, UserUpdateDTO> {
  constructor() {
    super(UserModel);
  }
}
