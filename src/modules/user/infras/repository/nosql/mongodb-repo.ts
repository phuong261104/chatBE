import { UserCondDTO, UserUpdateDTO } from "@/modules/user/model/dto";
import { User } from "@modules/user/model/model";
import { IUserLastSeenSyncPort } from "@modules/user/interface";
import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose,
} from "@share/repository/repo-mongoose";
import { UserModel } from "./dto";

export class MongoUserRepository
  extends BaseRepositoryMongoose<User, UserCondDTO, UserUpdateDTO>
  implements IUserLastSeenSyncPort
{
  constructor() {
    super(new MongoUserQueryRepository(), new MongoUserCommandRepository());
  }

  async syncLastSeenToDB(userId: string, timestamp: number): Promise<boolean> {
    try {
      if (!userId || !Number.isFinite(timestamp)) {
        return false;
      }

      const lastSeenAt = new Date(timestamp);
      if (Number.isNaN(lastSeenAt.getTime())) {
        return false;
      }

      const result = await UserModel.updateOne(
        {
          _id: userId,
          $or: [
            { lastSeen: { $exists: false } },
            { lastSeen: null },
            { lastSeen: { $lt: lastSeenAt } },
          ],
        },
        {
          $set: { lastSeen: lastSeenAt },
        },
      );

      if (!result.acknowledged) {
        return false;
      }

      if (result.matchedCount > 0) {
        return true;
      }

      const userExists = await UserModel.exists({ _id: userId });
      return !!userExists;
    } catch (error) {
      return false;
    }
  }
}

export class MongoUserQueryRepository extends BaseQueryRepositoryMongoose<
  User,
  UserCondDTO
> {
  constructor() {
    super(UserModel, { _id: -1 });
  }
}

export class MongoUserCommandRepository extends BaseCommandRepositoryMongoose<
  User,
  UserUpdateDTO
> {
  constructor() {
    super(UserModel);
  }
}
