import { Request, Response } from "express";
import { IMessagingUseCase } from "../../../interface";
import { SocketEvent } from "../../../constants/socket-events";
import { MessagingSocketService } from "../socket-service";
import { getAttachedMessage } from "../../../usecase/utility-messages";

export class PollController {
  private socketService?: MessagingSocketService;

  constructor(private readonly useCase: IMessagingUseCase) {}

  setSocketService(socketService: MessagingSocketService) {
    this.socketService = socketService;
  }

  async createPollAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const { question, options, isMultipleChoice, allowAddOption, allowChangeVote, showResultsBeforeClose, hideVoters, expiresAt } = req.body;
      const currentUserId = res.locals["requester"]?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.createPoll(
        groupId,
        currentUserId,
        question,
        options,
        isMultipleChoice,
        allowAddOption,
        allowChangeVote,
        showResultsBeforeClose,
        expiresAt,
        hideVoters,
      );

      const message = getAttachedMessage(poll, "timelineMessage");
      if (message) {
        await this.emitMessageToMembers(groupId, message);
      }
      this.socketService?.emitToGroupRoom(groupId, SocketEvent.POLL_NEW, {
        conversationId: groupId,
        poll,
        message,
      });

      res.status(201).json({ data: { poll, message } });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async getPollsAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const currentUserId = res.locals["requester"]?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { cursor, limit, status } = req.query;
      const result = await this.useCase.getPolls(
        groupId,
        currentUserId,
        cursor as string | undefined,
        limit ? Number(limit) : undefined,
        status as string | undefined,
      );

      res.status(200).json({ data: result.polls, nextCursor: result.nextCursor, hasMore: result.hasMore });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async getPollAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId)
        ? req.params.pollId[0]
        : req.params.pollId;
      const currentUserId = res.locals["requester"]?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.getPoll(pollId, currentUserId);
      res.status(200).json({ data: poll });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async votePollAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId)
        ? req.params.pollId[0]
        : req.params.pollId;
      const { optionIds } = req.body;
      const currentUserId = res.locals["requester"]?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.votePoll(pollId, currentUserId, optionIds);
      const activityMessage = getAttachedMessage(poll, "activityMessage");
      const activityMessageUpdated = (poll as any).activityMessageUpdated === true;
      if (activityMessage) {
        if (activityMessageUpdated) {
          this.socketService?.emitToGroupRoom(poll.conversationId, SocketEvent.MESSAGE_EDITED, {
            conversationId: poll.conversationId,
            message: activityMessage,
          });
        } else {
          await this.emitMessageToMembers(poll.conversationId, activityMessage);
        }
      }

      this.socketService?.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_VOTE, {
        pollId,
        userId: currentUserId,
        poll,
        activityMessage,
      });

      res.status(200).json({ data: poll });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async getPollResultsAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId)
        ? req.params.pollId[0]
        : req.params.pollId;
      const currentUserId = res.locals["requester"]?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.getPollResults(pollId, currentUserId);

      res.status(200).json({ data: poll });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async closePollAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId) ? req.params.pollId[0] : req.params.pollId;
      const currentUserId = res.locals["requester"]?.sub;
      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.closePoll(pollId, currentUserId);
      const systemMessage = getAttachedMessage(poll, "systemMessage");
      if (systemMessage) await this.emitMessageToMembers(poll.conversationId, systemMessage);
      this.socketService?.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_CLOSED, {
        conversationId: poll.conversationId,
        pollId,
        poll,
        closedBy: currentUserId,
        systemMessage,
      });
      res.status(200).json({ data: poll });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async pinPollAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId) ? req.params.pollId[0] : req.params.pollId;
      const currentUserId = res.locals["requester"]?.sub;
      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.pinPoll(pollId, currentUserId);
      const systemMessage = getAttachedMessage(poll, "systemMessage");
      if (systemMessage) await this.emitMessageToMembers(poll.conversationId, systemMessage);
      this.socketService?.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_PINNED, {
        conversationId: poll.conversationId,
        pollId,
        poll,
        pinnedBy: currentUserId,
        systemMessage,
      });
      res.status(200).json({ data: poll });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async unpinPollAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId) ? req.params.pollId[0] : req.params.pollId;
      const currentUserId = res.locals["requester"]?.sub;
      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.unpinPoll(pollId, currentUserId);
      const systemMessage = getAttachedMessage(poll, "systemMessage");
      if (systemMessage) await this.emitMessageToMembers(poll.conversationId, systemMessage);
      this.socketService?.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_UNPINNED, {
        conversationId: poll.conversationId,
        pollId,
        poll,
        unpinnedBy: currentUserId,
        systemMessage,
      });
      res.status(200).json({ data: poll });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async addPollOptionAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId) ? req.params.pollId[0] : req.params.pollId;
      const currentUserId = res.locals["requester"]?.sub;
      const { text } = req.body;
      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.addPollOption(pollId, currentUserId, text);
      const systemMessage = getAttachedMessage(poll, "systemMessage");
      if (systemMessage) {
        await this.emitMessageToMembers(poll.conversationId, systemMessage);
      }
      this.socketService?.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_OPTION_ADDED, {
        conversationId: poll.conversationId,
        pollId,
        poll,
        addedBy: currentUserId,
      });
      res.status(200).json({ data: poll });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async deletePollAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId) ? req.params.pollId[0] : req.params.pollId;
      const currentUserId = res.locals["requester"]?.sub;
      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.getPollResults(pollId, currentUserId);
      await this.useCase.deletePoll(pollId, currentUserId);
      this.socketService?.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_DELETED, {
        conversationId: poll.conversationId,
        pollId,
        deletedBy: currentUserId,
      });
      res.status(200).json({ data: { pollId } });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  private async emitMessageToMembers(conversationId: string, message: unknown) {
    if (!this.socketService || !message) return;
    const memberUserIds = await this.useCase.getConversationMembers(conversationId);
    for (const userId of memberUserIds) {
      this.socketService.emitToUser(userId, SocketEvent.RECEIVE_MESSAGE, {
        conversationId,
        message,
      });
    }
  }

  private sendError(res: Response, error: unknown) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 400).json({ error: err.message });
  }
}
