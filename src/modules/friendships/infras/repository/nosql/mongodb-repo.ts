import { FriendshipCondDTO, FriendshipUpdateDTO } from '@modules/friendships/model/dto';
import { Friendship } from '@modules/friendships/model/model';
import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose
} from '@share/repository/repo-mongoose';
import { FriendshipModel } from './dto';

export class MongoFriendshipRepository extends BaseRepositoryMongoose<
  Friendship,
  FriendshipCondDTO,
  FriendshipUpdateDTO
> {
  constructor() {
    super(new MongoFriendshipQueryRepository(), new MongoFriendshipCommandRepository());
  }

  async deleteByCondition(cond: FriendshipCondDTO): Promise<boolean> {
    const result = await FriendshipModel.deleteOne(cond).exec();
    return result.deletedCount > 0;
  }

  async findFriendshipsForUser(userId: string): Promise<Friendship[]> {
    const data = await FriendshipModel.find({
      $or: [{ userA: userId }, { userB: userId }]
    })
      .lean()
      .exec();

    if (!data) return [];

    return data.map((doc) => {
      const { _id, __v, ...rest } = doc as any;
      return {
        ...rest,
        id: String(_id)
      } as Friendship;
    });
  }
}

export class MongoFriendshipQueryRepository extends BaseQueryRepositoryMongoose<Friendship, FriendshipCondDTO> {
  constructor() {
    super(FriendshipModel, { createdAt: -1 });
  }
}

export class MongoFriendshipCommandRepository extends BaseCommandRepositoryMongoose<Friendship, FriendshipUpdateDTO> {
  constructor() {
    super(FriendshipModel);
  }
}
