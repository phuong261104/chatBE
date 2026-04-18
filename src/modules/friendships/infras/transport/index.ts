import { IFriendshipUseCase } from "@modules/friendships/interface";
import { BaseHttpService } from "@share/transport/http-server";
import { Request, Response } from "express";
import { Friendship, FriendshipCondDTO, FriendshipCreateDTO, FriendshipUpdateDTO, GetFriendsListQuerySchema } from "../../model";
import { FriendNotificationSocketService } from "@modules/friend-requests/infras/transport/socket-service";
import { AppError } from "@share/app-error";

export class FriendshipHTTPService extends BaseHttpService<
  Friendship,
  FriendshipCreateDTO,
  FriendshipUpdateDTO,
  FriendshipCondDTO
> {
  private socketService?: FriendNotificationSocketService;

  constructor(readonly usecase: IFriendshipUseCase) {
    super(usecase);
  }

  setSocketService(socketService: FriendNotificationSocketService) {
    this.socketService = socketService;
  }

  private handleError(error: unknown, res: Response): void {
    if (error instanceof AppError) {
      res.status(error.getStatusCode()).json({ message: error.message });
      return;
    }
    res.status(400).json({ message: (error as Error).message });
  }

  async getFriendsListAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;

      const parsed = GetFriendsListQuerySchema.safeParse({
        cursor: req.query.cursor,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: req.query.sortBy || "newest",
      });

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }

      const result = await this.usecase.getFriendsList(userId, parsed.data);

      res.status(200).json({
        data: {
          items: result.friendships,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async unfriendAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const { friendId } = req.params;

      await this.usecase.unfriend(userId, String(friendId));

      if (this.socketService) {
        this.socketService.notifyUnfriended(String(friendId), {
          unfriendedBy: userId,
          timestamp: new Date(),
        });
      }

      res.status(204).send();
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async checkFriendshipAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const { friendId } = req.params;

      const isFriend = await this.usecase.areFriends(userId, String(friendId));
      res.status(200).json({ data: { isFriend } });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getMutualFriendsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const targetUserId = req.params.id as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const mutualFriends = await this.usecase.getMutualFriends(userId, targetUserId, limit);

      res.status(200).json({
        data: {
          items: mutualFriends,
          total: mutualFriends.length,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getFriendSuggestionsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const limit = parseInt(req.query.limit as string) || 20;

      const suggestions = await this.usecase.getFriendSuggestions(userId, limit);

      res.status(200).json({
        data: {
          items: suggestions,
          total: suggestions.length,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async countFriendsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;

      const count = await this.usecase.getFriendsCount(userId);

      res.status(200).json({ data: { count } });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async searchFriendsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const q = (req.query.q as string) || "";
      const cursor = req.query.cursor as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!q.trim()) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      const result = await this.usecase.searchFriends(userId, q, cursor, limit);

      res.status(200).json({ data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }
}
