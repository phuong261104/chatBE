import { IFriendRequestUseCase } from "@modules/friend-requests/interface";
import { BaseHttpService } from "@share/transport/http-server";
import { Request, Response } from "express";
import {
  FriendRequest,
  FriendRequestCondDTO,
  FriendRequestCreateDTO,
  FriendRequestStatus,
  FriendRequestUpdateDTO,
} from "../../model";
import { FriendNotificationSocketService } from "./socket-service";

export { FriendNotificationSocketService };

export class FriendRequestHTTPService extends BaseHttpService<
  FriendRequest,
  FriendRequestCreateDTO,
  FriendRequestUpdateDTO,
  FriendRequestCondDTO
> {
  private socketService?: FriendNotificationSocketService;

  constructor(readonly usecase: IFriendRequestUseCase) {
    super(usecase);
  }

  setSocketService(socketService: FriendNotificationSocketService) {
    this.socketService = socketService;
  }

  async sendFriendRequestAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const fromUserId = requester.sub;
      const { receiverId } = req.params;

      const requestId = await this.usecase.sendFriendRequest(
        fromUserId,
        String(receiverId),
      );

      if (this.socketService) {
        this.socketService.notifyFriendRequestReceived(String(receiverId), {
          requestId,
          fromUserId,
          toUserId: String(receiverId),
        });
      }

      res.status(201).json({
        data: {
          id: requestId,
          status: FriendRequestStatus.PENDING,
        },
      });
    } catch (error) {
      const err = error as Error;
      if (err.message.toLowerCase().includes("blocked")) {
        res.status(403).json({
          message: err.message,
        });
        return;
      }

      res.status(422).json({
        message: err.message,
      });
    }
  }

  async updateFriendRequestStatusAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const { requestId } = req.params;
      const { status } = req.body as { status?: FriendRequestStatus };

      if (!status || !Object.values(FriendRequestStatus).includes(status)) {
        res.status(422).json({ message: "Invalid status" });
        return;
      }

      const request = await this.usecase.getDetail(String(requestId));
      if (!request) {
        res.status(404).json({ message: "Friend request not found" });
        return;
      }

      if (status === FriendRequestStatus.ACCEPTED) {
        await this.usecase.acceptFriendRequest(String(requestId), userId);

        if (this.socketService) {
          this.socketService.notifyFriendRequestAccepted(request.fromUserId, {
            requestId,
            acceptedBy: userId,
            fromUserId: request.fromUserId,
            toUserId: request.toUserId,
          });
        }
      }

      if (status === FriendRequestStatus.REJECTED) {
        await this.usecase.rejectFriendRequest(String(requestId), userId);

        if (this.socketService) {
          this.socketService.notifyFriendRequestRejected(request.fromUserId, {
            requestId,
            rejectedBy: userId,
            fromUserId: request.fromUserId,
            toUserId: request.toUserId,
          });
        }
      }

      if (status === FriendRequestStatus.CANCELED) {
        await this.usecase.cancelFriendRequest(String(requestId), userId);

        if (this.socketService) {
          this.socketService.notifyFriendRequestCanceled(request.toUserId, {
            requestId,
            canceledBy: userId,
            fromUserId: request.fromUserId,
            toUserId: request.toUserId,
          });
        }
      }

      res.status(200).json({ data: { id: requestId, status } });
    } catch (error) {
      const err = error as Error;
      let statusCode = 400;
      if (err.message.toLowerCase().includes("not found")) statusCode = 404;
      if (err.message.includes("Unauthorized")) statusCode = 403;

      res.status(statusCode).json({
        message: err.message,
      });
    }
  }

  async cancelFriendRequestAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const { requestId } = req.params;

      const request = await this.usecase.getDetail(String(requestId));
      if (!request) {
        res.status(404).json({ message: "Friend request not found" });
        return;
      }

      await this.usecase.cancelFriendRequest(String(requestId), userId);

      if (this.socketService) {
        this.socketService.notifyFriendRequestCanceled(request.toUserId, {
          requestId,
          canceledBy: userId,
          fromUserId: request.fromUserId,
          toUserId: request.toUserId,
        });
      }

      res.status(204).send();
    } catch (error) {
      const err = error as Error;
      let statusCode = 400;
      if (err.message.toLowerCase().includes("not found")) statusCode = 404;
      if (err.message.includes("Unauthorized")) statusCode = 403;

      res.status(statusCode).json({
        message: err.message,
      });
    }
  }

  async getReceivedRequestsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const requests = await this.usecase.getReceivedRequests(userId);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const paginatedRequests = requests.slice(startIndex, endIndex);

      res.status(200).json({
        data: {
          items: paginatedRequests,
          total: requests.length,
          page,
          limit,
          hasMore: endIndex < requests.length,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }

  async getSentRequestsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;
      const requests = await this.usecase.getSentRequests(userId);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const paginatedRequests = requests.slice(startIndex, endIndex);

      res.status(200).json({
        data: {
          items: paginatedRequests,
          total: requests.length,
          page,
          limit,
          hasMore: endIndex < requests.length,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }
}
