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
import { DynamoStoryRepository, DynamoStoryViewRepository } from "../infras/repository/dynamodb";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { DynamoConversationRepository } from "@modules/chat/infras/repository/dynamodb";
import { ConversationType } from "@modules/chat/model/model";

const STORY_DURATION_MS = 24 * 60 * 60 * 1000;

export class StoryUseCase implements IStoryUseCase {
  constructor(
    private readonly storyRepo: DynamoStoryRepository,
    private readonly viewRepo: DynamoStoryViewRepository,
    private readonly friendshipRepo: DynamoFriendshipRepository,
    private readonly conversationRepo: DynamoConversationRepository,
    private readonly blockRepo?: any,
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
    const visibleFriendIds: string[] = [];
    for (const friendId of friendIds) {
      if (!(await this.hasAnyBlock(userId, friendId))) {
        visibleFriendIds.push(friendId);
      }
    }
    const authorIds = [userId, ...visibleFriendIds];
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
    await this.assertCanViewStory(userId, story);

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
    await this.assertCanViewStory(userId, story);

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
    await this.assertCanViewStory(userId, story);

    const pairKey = [userId, story.authorId].sort().join("_");
    const existing = await this.conversationRepo.findByPairKey(pairKey, ConversationType.PRIVATE);

    if (existing) {
      return { conversationId: existing.id };
    }

    return { conversationId: pairKey };
  }

  private async assertCanViewStory(userId: string, story: Story): Promise<void> {
    if (story.authorId === userId) return;
    if (await this.hasAnyBlock(userId, story.authorId)) {
      throw AppError.from(ErrStoryUnauthorized, 403);
    }
  }

  private async hasAnyBlock(userA: string, userB: string): Promise<boolean> {
    if (!this.blockRepo || userA === userB) return false;
    const [blockedByA, blockedByB] = await Promise.all([
      this.blockRepo.findByCond({ blockerId: userA, blockedUserId: userB }),
      this.blockRepo.findByCond({ blockerId: userB, blockedUserId: userA }),
    ]);
    return !!(blockedByA || blockedByB);
  }
}
