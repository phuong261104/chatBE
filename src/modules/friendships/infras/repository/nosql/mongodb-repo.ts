import { FriendshipCondDTO, FriendshipUpdateDTO, Friendship } from '@modules/friendships/model';
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

  async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.findFriendshipsForUser(userId);
    return friendships.map((f) => (f.userA === userId ? f.userB : f.userA));
  }

  async getMutualFriendIds(userId1: string, userId2: string): Promise<string[]> {
    const [friends1, friends2] = await Promise.all([
      this.getFriendIds(userId1),
      this.getFriendIds(userId2)
    ]);

    const set2 = new Set(friends2);
    return friends1.filter((id) => set2.has(id));
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
