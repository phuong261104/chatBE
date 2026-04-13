import { IFriendshipUseCase } from "@modules/friendships/interface";
import { BaseHttpService } from "@share/transport/http-server";
import { Request, Response } from "express";
import { Friendship, FriendshipCondDTO, FriendshipCreateDTO, FriendshipUpdateDTO } from "../../model";
import { FriendNotificationSocketService } from "@modules/friend-requests/infras/transport/socket-service";

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

  async getFriendsListAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const friends = await this.usecase.getFriendsList(userId);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const paginatedFriends = friends.slice(startIndex, endIndex);

      res.status(200).json({
        data: {
          items: paginatedFriends,
          total: friends.length,
          page,
          limit,
          hasMore: endIndex < friends.length,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }

  async unfriendAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const { friendId } = req.params;

      await this.usecase.unfriend(userId, String(friendId));

      // Emit socket event để thông báo cho người kia bị unfriend
      if (this.socketService) {
        this.socketService.notifyUnfriended(String(friendId), {
          unfriendedBy: userId,
          timestamp: new Date(),
        });
      }

      res.status(204).send();
    } catch (error) {
      const err = error as Error;
      const statusCode = err.message.includes("not found") ? 404 : 400;
      res.status(statusCode).json({
        message: err.message,
      });
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
      res.status(400).json({
        message: (error as Error).message,
      });
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
      const err = error as Error;
      const statusCode = err.message.includes("not found") ? 404 : 400;
      res.status(statusCode).json({
        message: err.message,
      });
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
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }
}
