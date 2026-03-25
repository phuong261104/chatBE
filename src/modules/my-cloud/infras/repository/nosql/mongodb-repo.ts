import {
  CloudItem,
  CloudItemCondDTO,
  CloudItemUpdateDTO,
} from "@modules/my-cloud/model";
import {
  BaseRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseCommandRepositoryMongoose,
} from "@share/repository/repo-mongoose";
import { CloudItemModel } from "./dto";

export class MongoCloudItemRepository extends BaseRepositoryMongoose<
  CloudItem,
  CloudItemCondDTO,
  CloudItemUpdateDTO
> {
  constructor() {
    super(new MongoCloudItemQueryRepository(), new MongoCloudItemCommandRepository());
  }

  async countByUserId(userId: string, type?: string): Promise<number> {
    const filter: any = { userId };
    if (type) filter.type = type;
    return CloudItemModel.countDocuments(filter).exec();
  }
}

export class MongoCloudItemQueryRepository extends BaseQueryRepositoryMongoose<
  CloudItem,
  CloudItemCondDTO
> {
  constructor() {
    super(CloudItemModel, { createdAt: -1 });
  }
}

export class MongoCloudItemCommandRepository extends BaseCommandRepositoryMongoose<
  CloudItem,
  CloudItemUpdateDTO
> {
  constructor() {
    super(CloudItemModel);
  }
}
