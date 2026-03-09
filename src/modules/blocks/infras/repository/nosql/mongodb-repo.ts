import { BlockCondDTO, BlockUpdateDTO } from '@modules/blocks/model/dto';
import { Block } from '@modules/blocks/model/model';
import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose
} from '@share/repository/repo-mongoose';
import { BlockModel } from './dto';

export class MongoBlockRepository extends BaseRepositoryMongoose<Block, BlockCondDTO, BlockUpdateDTO> {
  constructor() {
    super(new MongoBlockQueryRepository(), new MongoBlockCommandRepository());
  }

  async deleteByCondition(cond: BlockCondDTO): Promise<boolean> {
    const result = await BlockModel.deleteOne(cond).exec();
    return result.deletedCount > 0;
  }

  async findAllByCond(cond: BlockCondDTO): Promise<Block[]> {
    const data = await BlockModel.find(cond as any)
      .lean()
      .exec();

    if (!data) return [];

    return data.map((doc) => {
      const { _id, __v, ...rest } = doc as any;
      return {
        ...rest,
        id: String(_id)
      } as Block;
    });
  }
}

export class MongoBlockQueryRepository extends BaseQueryRepositoryMongoose<Block, BlockCondDTO> {
  constructor() {
    super(BlockModel, { createdAt: -1 });
  }
}

export class MongoBlockCommandRepository extends BaseCommandRepositoryMongoose<Block, BlockUpdateDTO> {
  constructor() {
    super(BlockModel);
  }
}
