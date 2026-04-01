import { Story, StoryView, CreateStoryDTO, ReplyStoryDTO } from "../model";
import { PagingDTO } from "@share/model/paging";

export interface IStoryUseCase {
  createStory(userId: string, data: CreateStoryDTO): Promise<Story>;
  getStories(userId: string): Promise<{ authorId: string; stories: Story[] }[]>;
  getStoryById(userId: string, storyId: string): Promise<Story>;
  deleteStory(userId: string, storyId: string): Promise<void>;
  viewStory(userId: string, storyId: string): Promise<void>;
  getStoryViews(userId: string, storyId: string, paging: PagingDTO): Promise<{ views: StoryView[]; total: number }>;
  replyStory(userId: string, storyId: string, data: ReplyStoryDTO): Promise<{ conversationId: string }>;
}
