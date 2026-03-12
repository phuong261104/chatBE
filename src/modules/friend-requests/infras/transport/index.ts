import { IFriendRequestUseCase } from '@modules/friend-requests/interface';
import { BaseHttpService } from '@share/transport/http-server';
import { Request, Response } from 'express';
import { FriendRequest, FriendRequestCondDTO, FriendRequestCreateDTO, FriendRequestUpdateDTO } from '../../model';
import { FriendNotificationSocketService } from './socket-service';

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
      const requester = res.locals['requester'];
      const fromUserId = requester.sub;
      const { receiverId } = req.params;

      const requestId = await this.usecase.sendFriendRequest(fromUserId, String(receiverId));

      if (this.socketService) {
        this.socketService.notifyFriendRequestReceived(String(receiverId), {
          requestId,
          fromUserId,
          toUserId: String(receiverId)
        });
      }

      res.status(200).json({ data: { id: requestId, message: 'Friend request sent successfully' } });
    } catch (error) {
      const err = error as Error;
      const statusCode = err.message.includes('blocked') ? 403 : 400;
      res.status(statusCode).json({
        message: err.message
      });
    }
  }

  async acceptFriendRequestAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
      const userId = requester.sub;
      const { requestId } = req.params;

      const request = await this.usecase.getDetail(String(requestId));
      if (!request) {
        res.status(404).json({ message: 'Friend request not found' });
        return;
      }

      await this.usecase.acceptFriendRequest(String(requestId), userId);

      if (this.socketService) {
        this.socketService.notifyFriendRequestAccepted(request.fromUserId, {
          requestId,
          acceptedBy: userId,
          fromUserId: request.fromUserId,
          toUserId: request.toUserId
        });
      }

      res.status(200).json({ data: { message: 'Friend request accepted successfully' } });
    } catch (error) {
      const err = error as Error;
      let statusCode = 400;
      if (err.message.includes('not found')) statusCode = 404;
      if (err.message.includes('Unauthorized')) statusCode = 403;

      res.status(statusCode).json({
        message: err.message
      });
    }
  }

  async rejectFriendRequestAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
      const userId = requester.sub;
      const { requestId } = req.params;

      const request = await this.usecase.getDetail(String(requestId));
      if (!request) {
        res.status(404).json({ message: 'Friend request not found' });
        return;
      }

      await this.usecase.rejectFriendRequest(String(requestId), userId);

      if (this.socketService) {
        this.socketService.notifyFriendRequestRejected(request.fromUserId, {
          requestId,
          rejectedBy: userId,
          fromUserId: request.fromUserId,
          toUserId: request.toUserId
        });
      }

      res.status(200).json({ data: { message: 'Friend request rejected successfully' } });
    } catch (error) {
      const err = error as Error;
      let statusCode = 400;
      if (err.message.includes('not found')) statusCode = 404;
      if (err.message.includes('Unauthorized')) statusCode = 403;

      res.status(statusCode).json({
        message: err.message
      });
    }
  }

  async cancelFriendRequestAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
      const userId = requester.sub;
      const { requestId } = req.params;

      const request = await this.usecase.getDetail(String(requestId));
      if (!request) {
        res.status(404).json({ message: 'Friend request not found' });
        return;
      }

      await this.usecase.cancelFriendRequest(String(requestId), userId);

      if (this.socketService) {
        this.socketService.notifyFriendRequestCanceled(request.toUserId, {
          requestId,
          canceledBy: userId,
          fromUserId: request.fromUserId,
          toUserId: request.toUserId
        });
      }

      res.status(200).json({ data: { message: 'Friend request canceled successfully' } });
    } catch (error) {
      const err = error as Error;
      let statusCode = 400;
      if (err.message.includes('not found')) statusCode = 404;
      if (err.message.includes('Unauthorized')) statusCode = 403;

      res.status(statusCode).json({
        message: err.message
      });
    }
  }

  async getReceivedRequestsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
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
          hasMore: endIndex < requests.length
        }
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message
      });
    }
  }

  async getSentRequestsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
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
          hasMore: endIndex < requests.length
        }
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message
      });
    }
  }
}
