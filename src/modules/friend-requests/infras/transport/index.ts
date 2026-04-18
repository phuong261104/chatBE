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
import { AppError } from "@share/app-error";
import { checkRateLimit } from "@share/utils/rate-limiter";

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

      const rateLimit = await checkRateLimit(
        `friendrequest:${fromUserId}`,
        10,
        60,
      );

      if (!rateLimit.allowed) {
        res.set("Retry-After", rateLimit.resetIn.toString());
        res.set("X-RateLimit-Remaining", "0");
        res.set("X-RateLimit-Limit", "10");
        res.status(429).json({
          message: "Too many friend requests. Please try again later.",
          retryAfter: rateLimit.resetIn,
        });
        return;
      }

      res.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
      res.set("X-RateLimit-Limit", "10");

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

      if (status === FriendRequestStatus.PENDING) {
        res.status(422).json({ message: "Cannot set status to pending" });
        return;
      }

      res.status(200).json({ data: { id: requestId, status } });
    } catch (error) {
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({
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
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({ message: err.message });
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
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({ message: err.message });
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
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({ message: err.message });
    }
  }

  async checkFriendRequestStatusAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const currentUserId = requester.sub;
      const { targetUserId } = req.params;

      const result = await this.usecase.checkFriendRequestStatus(
        currentUserId,
        String(targetUserId),
      );

      if (result.status === "BLOCKED" && this.socketService) {
        this.socketService.notifyBlockDetected(
          currentUserId,
          result.direction as "BLOCKING" | "BLOCKED_BY",
          result.direction === "BLOCKING" ? String(targetUserId) : undefined,
          result.direction === "BLOCKED_BY" ? String(targetUserId) : undefined,
        );
      }

      res.status(200).json({ data: result });
    } catch (error) {
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({ message: err.message });
    }
  }

  async getFriendRequestsCountAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester.sub;

      const counts = await this.usecase.getFriendRequestsCount(userId);

      res.status(200).json({
        data: {
          received: counts.received ?? 0,
          sent: counts.sent ?? 0,
        },
      });
    } catch (error) {
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({ message: err.message });
    }
  }
}
