import { Request, Response } from "express";
import { IStoryUseCase } from "../../interface";

export class StoryHTTPService {
  constructor(private readonly useCase: IStoryUseCase) {}

  async createStoryAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const story = await this.useCase.createStory(userId, req.body);
    res.status(201).json({ data: story });
  }

  async getStoriesAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await this.useCase.getStories(userId);
    res.status(200).json({ data: result });
  }

  async getStoryByIdAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const storyId = String(req.params.id);
    const story = await this.useCase.getStoryById(userId, storyId);
    res.status(200).json({ data: story });
  }

  async deleteStoryAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const storyId = String(req.params.id);
    await this.useCase.deleteStory(userId, storyId);
    res.status(204).send();
  }

  async viewStoryAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const storyId = String(req.params.id);
    await this.useCase.viewStory(userId, storyId);
    res.status(200).json({ data: { message: "Story viewed" } });
  }

  async getStoryViewsAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const storyId = String(req.params.id);
    const result = await this.useCase.getStoryViews(userId, storyId, { page, limit });
    res.status(200).json({
      data: {
        views: result.views,
        total: result.total,
        page,
        limit,
        hasMore: page * limit < result.total,
      },
    });
  }

  async replyStoryAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const storyId = String(req.params.id);
    const result = await this.useCase.replyStory(userId, storyId, req.body);
    res.status(200).json({ data: result });
  }
}
