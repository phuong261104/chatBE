import { Request, Response } from 'express';
import { z } from 'zod';
import {
  ConversationMemberStatus,
  ConversationType,
} from '@modules/chat';
import {
  callV2Service,
  CallV2Session,
  CallV2SessionStatus,
  TerminalCallLogStatus,
} from '../../../usecase';
import { CallType, LivekitProvider } from '../../../interface';
import {
  ICallBlockRepository,
  ICallConversationMemberRepository,
  ICallConversationRepository,
  ICallLogService,
  ICallSocketNotifier,
} from '../../../interface';
import { livekitService } from '../../livekit';
import { Requester } from '@share/interface';
import Logger from '@share/utils/logger';

const CreateCallV2DtoSchema = z.object({
  conversationId: z.string().min(1),
  type: z.nativeEnum(CallType),
  inviteeIds: z.array(z.string().min(1)).optional(),
  inviteAll: z.boolean().optional(),
});

export class CallV2Controller {
  private socketService: ICallSocketNotifier | null = null;

  constructor(
    private readonly conversationRepo: ICallConversationRepository,
    private readonly conversationMemberRepo: ICallConversationMemberRepository,
    private readonly blockRepo: ICallBlockRepository,
    private readonly callLogService: ICallLogService,
  ) {
    callV2Service.setTimeoutHandler(async (session, missedUserIds, terminal) => {
      for (const userId of missedUserIds) {
        this.socketService?.emitToUser(userId, 'call:missed', {
          callId: session.callId,
          conversationId: session.conversationId,
          userId,
        });
      }
      this.socketService?.notifyMissed(session.callId, {
        callId: session.callId,
        conversationId: session.conversationId,
        missedUserIds,
        status: session.status,
      });

      if (terminal) {
        const callMessage = await this.logTerminalCall(session, 'missed', 'timeout');
        this.notifyCallEnded(session, callMessage);
      }
    });
  }

  setSocketService(socketService: ICallSocketNotifier) {
    this.socketService = socketService;
  }

  createCall = async (req: Request, res: Response) => {
    try {
      const callerId = this.getCurrentUserId(res);
      if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

      const dto = CreateCallV2DtoSchema.parse(req.body);
      const conversation = await this.conversationRepo.get(dto.conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const activeMembers = await this.getActiveMembers(dto.conversationId);
      const callerMember = activeMembers.find((member) => member.userId === callerId);
      if (!callerMember) return res.status(403).json({ error: 'Caller is not an active member' });

      const isGroup = conversation.type === ConversationType.GROUP;
      const calleeIds = isGroup
        ? this.resolveGroupInvitees(callerId, activeMembers, dto.inviteeIds, dto.inviteAll)
        : this.resolvePrivateInvitees(callerId, activeMembers);

      if (calleeIds.length === 0) {
        return res.status(400).json({ error: 'No eligible invitees for this call' });
      }

      await this.ensureNoBlockRelations(callerId, calleeIds);

      const { session, invitedUserIds, busyUserIds } = callV2Service.createCall({
        callerId,
        conversationId: dto.conversationId,
        type: dto.type,
        calleeIds,
        isGroup,
        livekitProvider: LivekitProvider.CLOUD,
      });

      if (!isGroup && busyUserIds.length > 0) {
        const callMessage = await this.logTerminalCall(session, 'missed', callerId);
        this.socketService?.notifyBusy(callerId, {
          callId: session.callId,
          conversationId: session.conversationId,
          busyUserIds,
        });
        return res.status(409).json({
          error: 'Callee is busy',
          data: {
            call: callV2Service.toResponse(session),
            busyUserIds,
            callMessage,
          },
        });
      }

      const callData = {
        callId: session.callId,
        callerId: session.callerId,
        type: session.type,
        conversationId: session.conversationId,
        roomName: session.roomName,
        status: session.status,
        livekitProvider: session.livekitProvider,
        apiVersion: 'v2',
        busyUserIds,
      };

      for (const userId of invitedUserIds) {
        this.socketService?.notifyIncomingCall(userId, callData);
      }
      if (busyUserIds.length > 0) {
        this.socketService?.notifyBusy(callerId, {
          callId: session.callId,
          conversationId: session.conversationId,
          busyUserIds,
        });
      }
      this.socketService?.notifyOngoingCall(callerId, callData);

      return res.status(201).json({
        data: {
          call: callV2Service.toResponse(session),
          invitedUserIds,
          busyUserIds,
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  joinCall = async (req: Request, res: Response) => {
    try {
      const userId = this.getCurrentUserId(res);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callV2Service.getCall(callId);
      if (!session) return res.status(404).json({ error: 'Call not found' });
      await this.ensureCanJoin(session, userId);

      const joined = callV2Service.joinCall(callId, userId);
      const token = await livekitService.generateToken(
        joined.roomName,
        userId,
        userId,
        joined.livekitProvider,
      );
      const wsUrl = livekitService.getWsUrl(joined.livekitProvider);

      this.socketService?.notifyJoined(joined.callId, {
        callId: joined.callId,
        conversationId: joined.conversationId,
        userId,
        status: joined.status,
        participant: joined.participants[userId],
      });
      this.notifyParticipantUsers(joined, 'call:joined', {
        callId: joined.callId,
        conversationId: joined.conversationId,
        userId,
        status: joined.status,
      });

      return res.json({
        data: {
          call: callV2Service.toResponse(joined),
          token,
          wsUrl,
          roomName: joined.roomName,
          livekitProvider: joined.livekitProvider,
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  leaveCall = async (req: Request, res: Response) => {
    try {
      const userId = this.getCurrentUserId(res);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const { session, terminal } = callV2Service.leaveCall(callId, userId);
      this.socketService?.notifyLeft(session.callId, {
        callId: session.callId,
        conversationId: session.conversationId,
        userId,
        status: session.status,
      });
      this.notifyParticipantUsers(session, 'call:left', {
        callId: session.callId,
        conversationId: session.conversationId,
        userId,
        status: session.status,
      });

      const callMessage = terminal
        ? await this.logTerminalCall(session, this.getTerminalLogStatus(session), userId)
        : null;
      if (terminal) {
        this.notifyCallEnded(session, callMessage);
      }

      return res.json({
        data: {
          call: callV2Service.toResponse(session),
          terminal,
          callMessage,
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  rejectCall = async (req: Request, res: Response) => {
    try {
      const userId = this.getCurrentUserId(res);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const { session, terminal } = callV2Service.rejectCall(callId, userId);
      this.socketService?.notifyDeclined(session.callId, {
        callId: session.callId,
        conversationId: session.conversationId,
        userId,
        status: session.status,
      });
      this.notifyParticipantUsers(session, 'call:declined', {
        callId: session.callId,
        conversationId: session.conversationId,
        userId,
        status: session.status,
      });

      const callMessage = terminal
        ? await this.logTerminalCall(session, 'rejected', userId)
        : null;
      if (terminal) {
        this.notifyCallEnded(session, callMessage);
      }

      return res.json({
        data: {
          call: callV2Service.toResponse(session),
          terminal,
          callMessage,
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  missedCall = async (req: Request, res: Response) => {
    try {
      const userId = this.getCurrentUserId(res);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const { session, terminal } = callV2Service.markMissed(callId, userId);
      this.socketService?.notifyMissed(session.callId, {
        callId: session.callId,
        conversationId: session.conversationId,
        userId,
        status: session.status,
      });
      this.notifyParticipantUsers(session, 'call:missed', {
        callId: session.callId,
        conversationId: session.conversationId,
        userId,
        status: session.status,
      });

      const callMessage = terminal
        ? await this.logTerminalCall(session, 'missed', userId)
        : null;
      if (terminal) {
        this.notifyCallEnded(session, callMessage);
      }

      return res.json({
        data: {
          call: callV2Service.toResponse(session),
          terminal,
          callMessage,
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  endCall = async (req: Request, res: Response) => {
    try {
      const userId = this.getCurrentUserId(res);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callV2Service.endCall(callId, userId);
      const callMessage = await this.logTerminalCall(
        session,
        this.getTerminalLogStatus(session),
        userId,
      );
      this.notifyCallEnded(session, callMessage);

      return res.json({
        data: {
          call: callV2Service.toResponse(session),
          callMessage,
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getToken = async (req: Request, res: Response) => {
    try {
      const userId = this.getCurrentUserId(res);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callV2Service.getCall(callId);
      if (!session) return res.status(404).json({ error: 'Call not found' });
      if (!session.participants[userId]) return res.status(403).json({ error: 'Forbidden' });
      await this.ensureActiveConversationMember(session.conversationId, userId);

      const token = await livekitService.generateToken(
        session.roomName,
        userId,
        userId,
        session.livekitProvider,
      );
      const wsUrl = livekitService.getWsUrl(session.livekitProvider);

      return res.json({
        data: {
          token,
          wsUrl,
          roomName: session.roomName,
          livekitProvider: session.livekitProvider,
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getActiveByConversation = async (req: Request, res: Response) => {
    try {
      const userId = this.getCurrentUserId(res);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { conversationId } = req.params;
      await this.ensureActiveConversationMember(conversationId, userId);
      const session = callV2Service.getActiveCallByConversation(conversationId);

      return res.json({
        data: session ? callV2Service.toResponse(session) : null,
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  private resolvePrivateInvitees(callerId: string, members: Array<{ userId: string }>) {
    const calleeIds = members.map((member) => member.userId).filter((id) => id !== callerId);
    if (calleeIds.length !== 1) {
      throw this.error('Private call requires exactly one callee', 400);
    }
    return calleeIds;
  }

  private resolveGroupInvitees(
    callerId: string,
    members: Array<{ userId: string }>,
    inviteeIds?: string[],
    inviteAll?: boolean,
  ) {
    const activeUserIds = new Set(members.map((member) => member.userId));
    if (inviteAll || !inviteeIds || inviteeIds.length === 0) {
      return members.map((member) => member.userId).filter((id) => id !== callerId);
    }

    const uniqueInvitees = Array.from(new Set(inviteeIds)).filter((id) => id !== callerId);
    const invalidInvitees = uniqueInvitees.filter((id) => !activeUserIds.has(id));
    if (invalidInvitees.length > 0) {
      throw this.error(`Invitees are not active group members: ${invalidInvitees.join(', ')}`, 400);
    }
    return uniqueInvitees;
  }

  private async ensureCanJoin(session: CallV2Session, userId: string) {
    const member = await this.ensureActiveConversationMember(session.conversationId, userId);
    if (!session.isGroup && !session.participants[userId]) {
      throw this.error('User is not a participant in this private call', 403);
    }
    if (!session.isGroup || session.participants[userId]) {
      return member;
    }
    if (session.status !== CallV2SessionStatus.IN_CALL && session.status !== CallV2SessionStatus.RINGING) {
      throw this.error('Group call is not joinable', 400);
    }
    return member;
  }

  private async ensureActiveConversationMember(conversationId: string, userId: string) {
    const member = await this.conversationMemberRepo.findByCond({ conversationId, userId });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw this.error('User is not an active conversation member', 403);
    }
    return member;
  }

  private async getActiveMembers(conversationId: string) {
    const members = await this.conversationMemberRepo.listByConversationId(conversationId);
    return members.filter(
      (member) => !member.leftAt && member.status === ConversationMemberStatus.ACTIVE,
    );
  }

  private async ensureNoBlockRelations(callerId: string, calleeIds: string[]) {
    for (const calleeId of calleeIds) {
      const callerBlocked = await this.blockRepo.findByCond({
        blockerId: callerId,
        blockedUserId: calleeId,
      });
      const calleeBlocked = await this.blockRepo.findByCond({
        blockerId: calleeId,
        blockedUserId: callerId,
      });
      if (callerBlocked || calleeBlocked) {
        throw this.error('Call is blocked by user relationship', 403);
      }
    }
  }

  private async logTerminalCall(
    session: CallV2Session,
    status: TerminalCallLogStatus,
    endedBy: string,
  ) {
    try {
      const legacy = callV2Service.toLegacySession(session);
      const message = await this.callLogService.createTerminalLog(legacy, status, endedBy);
      if (message) {
        session.loggedMessageId = message.id;
        callV2Service.markLogged(session.callId, message.id);
      }
      return message;
    } catch (err) {
      Logger.error('[CallV2Controller] Failed to create call log message');
      return null;
    }
  }

  private notifyCallEnded(session: CallV2Session, callMessage: unknown) {
    const payload = {
      callId: session.callId,
      conversationId: session.conversationId,
      status: session.status,
      endedAt: session.endedAt,
      endedBy: session.endedBy,
      callMessage,
    };
    this.socketService?.notifyEnded(session.callId, payload);
    this.notifyParticipantUsers(session, 'call:ended', payload);
  }

  private notifyParticipantUsers(session: CallV2Session, event: string, payload: unknown) {
    for (const userId of Object.keys(session.participants)) {
      this.socketService?.emitToUser(userId, event, payload);
    }
  }

  private getTerminalLogStatus(session: CallV2Session): TerminalCallLogStatus {
    if (session.status === CallV2SessionStatus.MISSED) return 'missed';
    if (session.status === CallV2SessionStatus.REJECTED) return 'rejected';
    if (session.status === CallV2SessionStatus.CANCELLED) return 'cancelled';
    return 'completed';
  }

  private getCurrentUserId(res: Response): string | null {
    const locals = res.locals as { requester?: Requester };
    return locals.requester?.sub || null;
  }

  private sendError(res: Response, err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(422).json({ error: 'Validation error', details: err.errors });
    }
    const error = err as Error & { statusCode?: number };
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  private error(message: string, statusCode: number) {
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = statusCode;
    return err;
  }
}
