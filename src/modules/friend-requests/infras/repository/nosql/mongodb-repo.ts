import { FriendRequestCondDTO, FriendRequestUpdateDTO } from '@modules/friend-requests/model/dto';
import { FriendRequest } from '@modules/friend-requests/model/model';
import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose
} from '@share/repository/repo-mongoose';
import { FriendRequestModel } from './dto';

export class MongoFriendRequestRepository extends BaseRepositoryMongoose<
  FriendRequest,
  FriendRequestCondDTO,
  FriendRequestUpdateDTO
> {
  constructor() {
    super(new MongoFriendRequestQueryRepository(), new MongoFriendRequestCommandRepository());
  }
}

export class MongoFriendRequestQueryRepository extends BaseQueryRepositoryMongoose<
  FriendRequest,
  FriendRequestCondDTO
> {
  constructor() {
    super(FriendRequestModel, { createdAt: -1 });
  }
}

export class MongoFriendRequestCommandRepository extends BaseCommandRepositoryMongoose<
  FriendRequest,
  FriendRequestUpdateDTO
> {
  constructor() {
    super(FriendRequestModel);
  }
}
