import { Request, Response } from 'express';
import { callService } from '../services/call.service';
import { livekitService } from '../services/livekit.service';
import { CallSocketService } from '../infras/transport/call-socket.service';
import { CreateCallDtoSchema } from '../dto/create-call.dto';
import { DynamoConversationMemberRepository } from '@modules/chat';

export class CallController {
  private socketService: CallSocketService | null = null;
  private conversationMemberRepo: DynamoConversationMemberRepository;

  constructor(conversationMemberRepo: DynamoConversationMemberRepository) {
    this.conversationMemberRepo = conversationMemberRepo;
  }

  setSocketService(socketService: CallSocketService) {
    this.socketService = socketService;
  }

  createCall = async (req: Request, res: Response) => {
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

      const session = callService.createCall(callerId, conversationId, type, resolvedCalleeIds);

      const callData = {
        callId: session.callId,
        callerId: session.callerId,
        type: session.type,
        conversationId: session.conversationId,
        roomName: session.roomName,
      };

      for (const calleeId of session.calleeIds) {
        this.socketService?.notifyIncomingCall(calleeId, callData);
      }

      this.socketService?.notifyRinging(session.callerId, session.callId);

      return res.status(201).json({ callId: session.callId, roomName: session.roomName, type: session.type });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  answerCall = async (req: Request, res: Response) => {
    try {
      const userId = (res as any).locals?.["requester"]?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callService.answerCall(callId, userId);
      console.log(`[answerCall] userId=${userId} callId=${callId} callerId=${session.callerId} calleeIds=${JSON.stringify(session.calleeIds)}`);

      const callerToken = await livekitService.generateToken(
        session.roomName,
        session.callerId,
        session.callerId,
      );
      const answererToken = await livekitService.generateToken(session.roomName, userId, userId);
      const wsUrl = livekitService.getWsUrl();

      this.socketService?.notifyAnswered(
        session.callerId,
        session.callId,
        session.roomName,
        callerToken,
        wsUrl,
      );
      this.socketService?.notifyAnswered(
        userId,
        session.callId,
        session.roomName,
        answererToken,
        wsUrl,
      );

      return res.json({
        callId: session.callId,
        status: session.status,
        token: answererToken,
        wsUrl,
        roomName: session.roomName,
      });
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

      this.socketService?.notifyRejected(session.callerId, session.callId);

      return res.json({ callId: session.callId, status: session.status });
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

      this.socketService?.notifyMissed(session.callerId, session.callId);

      return res.json({ callId: session.callId, status: session.status });
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

      this.socketService?.notifyEnded(session.callerId, session.callId);
      for (const calleeId of session.calleeIds) {
        this.socketService?.notifyEnded(calleeId, session.callId);
      }

      return res.json({ callId: session.callId, status: session.status });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  getToken = async (req: Request, res: Response) => {
    try {
      const userId = (res as any).locals?.["requester"]?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { callId } = req.params;
      const session = callService.getCall(callId);
      if (!session) return res.status(404).json({ error: 'Call not found' });

      if (userId !== session.callerId && !session.calleeIds.includes(userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const token = await livekitService.generateToken(session.roomName, userId, userId);
      const wsUrl = livekitService.getWsUrl();

      return res.json({ token, wsUrl, roomName: session.roomName });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };
}
