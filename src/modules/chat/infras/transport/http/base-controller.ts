import { ConversationReadState, IMessagingUseCase } from "../../../interface";
import { MessagingSocketService } from "../socket-service";
import { Request, Response } from "express";
import { z } from "zod";

export abstract class BaseController {
  protected socketService?: MessagingSocketService;

  constructor(protected readonly useCase: IMessagingUseCase) {}

  setSocketService(socketService: MessagingSocketService) {
    this.socketService = socketService;
  }

  protected getCurrentUserId(req: Request, res: Response): string | null {
    const requester = res.locals["requester"];
    return requester?.sub || null;
  }

  protected sendUnauthorized(res: Response) {
    res.status(401).json({ error: "Unauthorized" });
  }

  protected sendValidationError(res: Response, error: z.ZodError) {
    res.status(422).json({
      error: "Validation error",
      details: error.errors,
    });
  }

  protected sendError(res: Response, error: unknown, statusCode = 400) {
    const err = error as any;
    res.status(err.statusCode || statusCode).json({
      error: err.message,
    });
  }

  protected parseIdParam(req: Request, paramName: string): string {
    const value = req.params[paramName];
    return Array.isArray(value) ? value[0] : value;
  }

  protected toReadStatePayload(state: ConversationReadState) {
    return {
      conversationId: state.conversationId,
      userId: state.userId,
      lastSeenMessageId: state.lastSeenMessageId,
      lastReadMessageId: state.lastReadMessageId,
      lastDeliveredMessageId: state.lastDeliveredMessageId,
      lastSeenAt: state.lastSeenAt,
      lastReadAt: state.lastReadAt,
      lastDeliveredAt: state.lastDeliveredAt,
      lastSeenMessageCreatedAt: state.lastSeenMessageCreatedAt,
      lastReadMessageCreatedAt: state.lastReadMessageCreatedAt,
      lastDeliveredMessageCreatedAt: state.lastDeliveredMessageCreatedAt,
      unreadCount: state.unreadCount,
      updatedAt: state.updatedAt,
    };
  }
}
