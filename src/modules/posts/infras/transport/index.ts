import { Request, Response } from "express";
import { IPostUseCase } from "../../interface";

export class PostHTTPService {
  constructor(private readonly useCase: IPostUseCase) {}

  async createPostAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const post = await this.useCase.createPost(userId, req.body);
    res.status(201).json({ data: post });
  }

  async getFeedAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const result = await this.useCase.getFeed(userId, { page, limit });
    res.status(200).json({
      data: {
        posts: result.posts,
        total: result.total,
        page,
        limit,
        hasMore: page * limit < result.total,
      },
    });
  }

  async getPostByIdAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = String(req.params.id);
    const post = await this.useCase.getPostById(userId, postId);
    res.status(200).json({ data: post });
  }

  async deletePostAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = String(req.params.id);
    await this.useCase.deletePost(userId, postId);
    res.status(204).send();
  }

  async reactPostAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = String(req.params.id);
    const result = await this.useCase.reactPost(userId, postId, req.body);
    res.status(200).json({ data: result });
  }

  async getCommentsAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const postId = String(req.params.id);
    const result = await this.useCase.getComments(postId, { page, limit });
    res.status(200).json({
      data: {
        comments: result.comments,
        total: result.total,
        page,
        limit,
        hasMore: page * limit < result.total,
      },
    });
  }

  async addCommentAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = String(req.params.id);
    const comment = await this.useCase.addComment(userId, postId, req.body);
    res.status(201).json({ data: comment });
  }

  async deleteCommentAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = String(req.params.id);
    const commentId = String(req.params.commentId);
    await this.useCase.deleteComment(userId, postId, commentId);
    res.status(204).send();
  }

  async sharePostAPI(req: Request, res: Response) {
    const userId = res.locals["requester"]?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = String(req.params.id);
    const post = await this.useCase.sharePost(userId, postId, req.body);
    res.status(201).json({ data: post });
  }
}
