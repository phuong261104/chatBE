import { Request, Response } from 'express';
import { callService } from '../services/call.service';
import { livekitService } from '../services/livekit.service';
import { CallSocketService } from '../infras/transport/call-socket.service';
import { CreateCallDtoSchema } from '../dto/create-call.dto';
import { DynamoConversationMemberRepository } from '@modules/chat';
import { CallSession, CallStatus, LivekitProvider } from '../interfaces/call.interface';
import { CallLogService, TerminalCallLogStatus } from '../services/call-log.service';

export class CallController {
  private socketService: CallSocketService | null = null;
  private conversationMemberRepo: DynamoConversationMemberRepository;
  private callLogService: CallLogService | null;

  constructor(
    conversationMemberRepo: DynamoConversationMemberRepository,
    callLogService?: CallLogService,
  ) {
    this.conversationMemberRepo = conversationMemberRepo;
    this.callLogService = callLogService ?? null;
  }

  setSocketService(socketService: CallSocketService) {
    this.socketService = socketService;
  }

  createCall = async (req: Request, res: Response) => {
    return this.createCallWithProvider(req, res, LivekitProvider.SELF_HOSTED, 'v1');
  };

  createCloudCall = async (req: Request, res: Response) => {
    return this.createCallWithProvider(req, res, LivekitProvider.CLOUD, 'v2');
  };

  private createCallWithProvider = async (
    req: Request,
    res: Response,
    livekitProvider: LivekitProvider,
    apiVersion: 'v1' | 'v2',
  ) => {
    try {
      const callerId = (res as any).locals?.["requester"]?.sub;
      if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

      const dto = CreateCallDtoSchema.parse(req.body);
      const { conversationId, type, calleeIds } = dto;

      let resolvedCalleeIds = calleeIds || [];
      if (resolvedCalleeIds.length === 0) {
        const members = await this.conversationMemberRepo.listByConversationId(conversationId);
        resolvedCalleeIds = members
          .map((m) => m.userId)
          .filter((id: string) => id !== callerId);
      }

      const session = callService.createCall(
        callerId,
        conversationId,
        type,
        resolvedCalleeIds,
        livekitProvider,
      );

      const callData = {
        callId: session.callId,
        callerId: session.callerId,
        type: session.type,
        conversationId: session.conversationId,
        roomName: session.roomName,
      };
      if (apiVersion === 'v2') {
        Object.assign(callData, {
          apiVersion,
          livekitProvider: session.livekitProvider,
        });
      }

      for (const calleeId of session.calleeIds) {
        this.socketService?.notifyIncomingCall(calleeId, callData);
      }

      this.socketService?.notifyRinging(session.callerId, session.callId);

      const responseBody = {
        callId: session.callId,
        roomName: session.roomName,
        type: session.type,
      };
      if (apiVersion === 'v2') {
        Object.assign(responseBody, {
          apiVersion,
          livekitProvider: session.livekitProvider,
        });
      }

      return res.status(201).json(responseBody);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  answerCall = async (req: Request, res: Response) => {
    return this.answerCallWithProvider(req, res);
  };

  answerCloudCall = async (req: Request, res: Response) => {
    return this.answerCallWithProvider(req, res, LivekitProvider.CLOUD);
  };

  private answerCallWithProvider = async (
    req: Request,
    res: Response,
    expectedProvider?: LivekitProvider,
  ) => {
    try {
      const userId = (res as any).locals?.["requester"]?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callService.answerCall(callId, userId);
      if (expectedProvider && session.livekitProvider !== expectedProvider) {
        return res.status(400).json({ error: 'Call does not belong to this LiveKit provider' });
      }
      console.log(`[answerCall] userId=${userId} callId=${callId} callerId=${session.callerId} calleeIds=${JSON.stringify(session.calleeIds)}`);

      const callerToken = await livekitService.generateToken(
        session.roomName,
        session.callerId,
        session.callerId,
        session.livekitProvider,
      );
      const answererToken = await livekitService.generateToken(
        session.roomName,
        userId,
        userId,
        session.livekitProvider,
      );
      const wsUrl = livekitService.getWsUrl(session.livekitProvider);

      const socketProvider =
        session.livekitProvider === LivekitProvider.CLOUD
          ? session.livekitProvider
          : undefined;

      this.socketService?.notifyAnswered(
        session.callerId,
        session.callId,
        session.roomName,
        callerToken,
        wsUrl,
        socketProvider,
      );
      this.socketService?.notifyAnswered(
        userId,
        session.callId,
        session.roomName,
        answererToken,
        wsUrl,
        socketProvider,
      );

      const responseBody = {
        callId: session.callId,
        status: session.status,
        token: answererToken,
        wsUrl,
        roomName: session.roomName,
      };
      if (session.livekitProvider === LivekitProvider.CLOUD) {
        Object.assign(responseBody, {
          apiVersion: 'v2',
          livekitProvider: session.livekitProvider,
        });
      }

      return res.json(responseBody);
    } catch (err: any) {
      console.error(`[answerCall] Error: ${err.message}`);
      return res.status(400).json({ error: err.message });
    }
  };

  rejectCall = async (req: Request, res: Response) => {
    try {
      const userId = (res as any).locals?.["requester"]?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callService.rejectCall(callId, userId);
      const callMessage = await this.logTerminalCall(session, 'rejected', userId);

      this.socketService?.notifyRejected(session.callerId, session.callId);

      return res.json({ callId: session.callId, status: session.status, callMessage });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  missedCall = async (req: Request, res: Response) => {
    try {
      const userId = (res as any).locals?.["requester"]?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callService.markMissed(callId, userId);
      const callMessage = await this.logTerminalCall(session, 'missed', userId);

      this.socketService?.notifyMissed(session.callerId, session.callId);

      return res.json({ callId: session.callId, status: session.status, callMessage });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  endCall = async (req: Request, res: Response) => {
    try {
      const userId = (res as any).locals?.["requester"]?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callService.endCall(callId, userId);
      const callMessage = await this.logTerminalCall(
        session,
        session.status === CallStatus.CANCELLED ? 'cancelled' : 'completed',
        userId,
      );

      this.socketService?.notifyEnded(session.callerId, session.callId);
      for (const calleeId of session.calleeIds) {
        this.socketService?.notifyEnded(calleeId, session.callId);
      }

      return res.json({ callId: session.callId, status: session.status, callMessage });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  getToken = async (req: Request, res: Response) => {
    return this.getTokenWithProvider(req, res);
  };

  getCloudToken = async (req: Request, res: Response) => {
    return this.getTokenWithProvider(req, res, LivekitProvider.CLOUD);
  };

  private getTokenWithProvider = async (
    req: Request,
    res: Response,
    expectedProvider?: LivekitProvider,
  ) => {
    try {
      const userId = (res as any).locals?.["requester"]?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callService.getCall(callId);
      if (!session) return res.status(404).json({ error: 'Call not found' });

      if (userId !== session.callerId && !session.calleeIds.includes(userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (expectedProvider && session.livekitProvider !== expectedProvider) {
        return res.status(400).json({ error: 'Call does not belong to this LiveKit provider' });
      }

      const token = await livekitService.generateToken(
        session.roomName,
        userId,
        userId,
        session.livekitProvider,
      );
      const wsUrl = livekitService.getWsUrl(session.livekitProvider);

      const responseBody = {
        token,
        wsUrl,
        roomName: session.roomName,
      };
      if (session.livekitProvider === LivekitProvider.CLOUD) {
        Object.assign(responseBody, {
          apiVersion: 'v2',
          livekitProvider: session.livekitProvider,
        });
      }

      return res.json(responseBody);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  private async logTerminalCall(
    session: CallSession,
    status: TerminalCallLogStatus,
    endedBy: string,
  ) {
    if (!this.callLogService) return null;
    try {
      const message = await this.callLogService.createTerminalLog(session, status, endedBy);
      if (message) {
        callService.markLogged(session.callId, message.id);
      }
      return message;
    } catch (err) {
      console.error('[CallController] Failed to create call log message:', err);
      return null;
    }
  }
}
