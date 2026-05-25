import {
  ControllerErrorLike,
  ConversationReadState,
  IMessagingUseCase,
} from "../../../interface";
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

  protected sendValidationError(res: Response, error: z.ZodError, statusCode = 422) {
    res.status(statusCode).json({
      error: "Validation error",
      details: error.errors,
    });
  }

  protected sendZodIssues(res: Response, error: z.ZodError, statusCode = 400) {
    res.status(statusCode).json({ error: error.errors });
  }

  protected sendError(res: Response, error: unknown, statusCode = 400) {
    const err = error as ControllerErrorLike;
    const resolvedStatusCode =
      typeof err.getStatusCode === "function"
        ? err.getStatusCode()
        : err.statusCode || statusCode;
    const json =
      typeof err.toJSON === "function"
        ? err.toJSON(process.env.NODE_ENV === "production")
        : undefined;

    res.status(resolvedStatusCode).json({
      error: json?.message || err.message,
      ...(json?.details ? { details: json.details } : {}),
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
