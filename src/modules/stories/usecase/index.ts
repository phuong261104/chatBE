import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import { IStoryUseCase } from "../interface";
import {
  Story,
  StoryView,
  createStoryDTOSchema,
  replyStoryDTOSchema,
  CreateStoryDTO,
  ReplyStoryDTO,
  ErrStoryNotFound,
  ErrStoryUnauthorized,
} from "../model";
import { PagingDTO } from "@share/model/paging";
import { MongoStoryRepository, MongoStoryViewRepository } from "../infras/repository";
import { MongoFriendshipRepository } from "@modules/friendships/infras/repository/nosql/mongodb-repo";
import { ConversationModel } from "@modules/chat/infras/repository/nosql/schemas";
import { ConversationType } from "@modules/chat/model/model";

const STORY_DURATION_MS = 24 * 60 * 60 * 1000;

export class StoryUseCase implements IStoryUseCase {
  constructor(
    private readonly storyRepo: MongoStoryRepository,
    private readonly viewRepo: MongoStoryViewRepository,
    private readonly friendshipRepo: MongoFriendshipRepository,
  ) {}

  async createStory(userId: string, data: CreateStoryDTO): Promise<Story> {
    const validated = createStoryDTOSchema.parse(data);
    const now = new Date();

    const story: Story = {
      id: v7(),
      authorId: userId,
      type: validated.type,
      content: validated.content,
      mediaUrl: validated.mediaUrl,
      backgroundColor: validated.backgroundColor,
      textStyle: validated.textStyle,
      viewersCount: 0,
      expiresAt: new Date(now.getTime() + STORY_DURATION_MS),
      createdAt: now,
    };

    await this.storyRepo.insert(story);
    return story;
  }

  async getStories(userId: string): Promise<{ authorId: string; stories: Story[] }[]> {
    const friendIds = await this.friendshipRepo.getFriendIds(userId);
    const authorIds = [userId, ...friendIds];
    const stories = await this.storyRepo.getActiveByAuthorIds(authorIds);

    const grouped = new Map<string, Story[]>();
    for (const story of stories) {
      const arr = grouped.get(story.authorId) || [];
      arr.push(story);
      grouped.set(story.authorId, arr);
    }

    const result: { authorId: string; stories: Story[] }[] = [];

    const myStories = grouped.get(userId);
    if (myStories) {
      result.push({ authorId: userId, stories: myStories });
      grouped.delete(userId);
    }

    for (const [authorId, authorStories] of grouped) {
      result.push({ authorId, stories: authorStories });
    }

    return result;
  }

  async getStoryById(userId: string, storyId: string): Promise<Story> {
    const story = await this.storyRepo.get(storyId);
    if (!story) throw AppError.from(ErrStoryNotFound, 404);

    if (new Date() > story.expiresAt && story.authorId !== userId) {
      throw AppError.from(ErrStoryNotFound, 404);
    }

    return story;
  }

  async deleteStory(userId: string, storyId: string): Promise<void> {
    const story = await this.storyRepo.get(storyId);
    if (!story) throw AppError.from(ErrStoryNotFound, 404);
    if (story.authorId !== userId) throw AppError.from(ErrStoryUnauthorized, 403);
    await this.storyRepo.delete(storyId, true);
  }

  async viewStory(userId: string, storyId: string): Promise<void> {
    const story = await this.storyRepo.get(storyId);
    if (!story) throw AppError.from(ErrStoryNotFound, 404);

    const existing = await this.viewRepo.findByStoryAndUser(storyId, userId);
    if (existing) return;

    await this.viewRepo.insert({
      id: v7(),
      storyId,
      userId,
      viewedAt: new Date(),
    });

    await this.storyRepo.incrementViewersCount(storyId);
  }

  async getStoryViews(
    userId: string,
    storyId: string,
    paging: PagingDTO,
  ): Promise<{ views: StoryView[]; total: number }> {
    const story = await this.storyRepo.get(storyId);
    if (!story) throw AppError.from(ErrStoryNotFound, 404);
    if (story.authorId !== userId) throw AppError.from(ErrStoryUnauthorized, 403);
    return this.viewRepo.listByStoryId(storyId, paging);
  }

  async replyStory(userId: string, storyId: string, data: ReplyStoryDTO): Promise<{ conversationId: string }> {
    replyStoryDTOSchema.parse(data);
    const story = await this.storyRepo.get(storyId);
    if (!story) throw AppError.from(ErrStoryNotFound, 404);

    const pairKey = [userId, story.authorId].sort().join("_");
    const existing = await ConversationModel.findOne({
      type: ConversationType.PRIVATE,
      pairKey,
    }).lean().exec();

    if (existing) {
      return { conversationId: String(existing._id) };
    }

    return { conversationId: pairKey };
  }
}
