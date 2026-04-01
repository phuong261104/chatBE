import { Story, StoryView, StoryCondDTO, StoryUpdateDTO } from "@modules/stories/model";
import {
  BaseRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseCommandRepositoryMongoose,
} from "@share/repository/repo-mongoose";
import { StoryModel, StoryViewModel } from "./dto";
import { PagingDTO } from "@share/model/paging";

export class MongoStoryRepository extends BaseRepositoryMongoose<Story, StoryCondDTO, StoryUpdateDTO> {
  constructor() {
    super(new MongoStoryQueryRepository(), new MongoStoryCommandRepository());
  }

  async getActiveByAuthorIds(authorIds: string[]): Promise<Story[]> {
    const now = new Date();
    const rows = await StoryModel.find({
      authorId: { $in: authorIds },
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return rows.map((doc) => {
      const { _id, __v, ...rest } = doc as any;
      return { ...rest, id: String(_id) } as Story;
    });
  }

  async incrementViewersCount(storyId: string): Promise<void> {
    await StoryModel.updateOne({ _id: storyId }, { $inc: { viewersCount: 1 } }).exec();
  }
}

class MongoStoryQueryRepository extends BaseQueryRepositoryMongoose<Story, StoryCondDTO> {
  constructor() {
    super(StoryModel, { createdAt: -1 });
  }
}

class MongoStoryCommandRepository extends BaseCommandRepositoryMongoose<Story, StoryUpdateDTO> {
  constructor() {
    super(StoryModel);
  }
}

export class MongoStoryViewRepository {
  async findByStoryAndUser(storyId: string, userId: string): Promise<StoryView | null> {
    const doc = await StoryViewModel.findOne({ storyId, userId }).lean().exec();
    if (!doc) return null;
    const { _id, __v, ...rest } = doc as any;
    return { ...rest, id: String(_id) } as StoryView;
  }

  async insert(view: StoryView): Promise<void> {
    await StoryViewModel.create({ ...view, _id: view.id });
  }

  async listByStoryId(storyId: string, paging: PagingDTO): Promise<{ views: StoryView[]; total: number }> {
    const { page, limit } = paging;
    const filter = { storyId };
    const total = await StoryViewModel.countDocuments(filter).exec();
    const rows = await StoryViewModel.find(filter)
      .sort({ viewedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const views = rows.map((doc) => {
      const { _id, __v, ...rest } = doc as any;
      return { ...rest, id: String(_id) } as StoryView;
    });

    return { views, total };
  }
}
