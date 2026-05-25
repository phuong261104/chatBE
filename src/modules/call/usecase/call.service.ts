import { v4 as uuidv4 } from 'uuid';
import { CallSession, CallStatus, CallType, LivekitProvider } from '../model';

class CallService {
  private activeCalls: Map<string, CallSession> = new Map();
  private conversationCalls: Map<string, string> = new Map();

  private readonly STALE_CALL_TTL_MS = 5 * 60 * 1000; // 5 minutes

  createCall(
    callerId: string,
    conversationId: string,
    type: CallType,
    calleeIds: string[],
    livekitProvider: LivekitProvider = LivekitProvider.SELF_HOSTED,
  ): CallSession {
    const existingCallId = this.conversationCalls.get(conversationId);
    if (existingCallId) {
      const existing = this.activeCalls.get(existingCallId);
      if (existing) {
        if (existing.status === CallStatus.RINGING || existing.status === CallStatus.ANSWERED) {
          throw new Error('A call is already ringing in this conversation');
        }
        if (existing.endedAt && Date.now() - existing.endedAt < this.STALE_CALL_TTL_MS) {
          throw new Error('A call was recently ended in this conversation. Please wait a moment.');
        }
        this.activeCalls.delete(existingCallId);
      }
      this.conversationCalls.delete(conversationId);
    }

    const callId = uuidv4();
    const roomName = `call-${conversationId}-${callId.substring(0, 8)}`;
    const session: CallSession = {
      callId,
      callerId,
      calleeIds,
      type,
      status: CallStatus.RINGING,
      livekitProvider,
      conversationId,
      roomName,
      createdAt: Date.now(),
    };
    this.activeCalls.set(callId, session);
    this.conversationCalls.set(conversationId, callId);
    return session;
  }

  answerCall(callId: string, userId: string): CallSession {
    const session = this.activeCalls.get(callId);
    if (!session) throw new Error('Call not found');
    if (!session.calleeIds.includes(userId) && userId !== session.callerId) {
      throw new Error('User not authorized to answer this call');
    }
    if (session.status === CallStatus.ANSWERED) {
      return session;
    }
    if (session.status !== CallStatus.RINGING) throw new Error('Call is not ringing');
    session.status = CallStatus.ANSWERED;
    session.answeredAt = Date.now();
    return session;
  }

  rejectCall(callId: string, userId: string): CallSession {
    const session = this.activeCalls.get(callId);
    if (!session) throw new Error('Call not found');
    if (!session.calleeIds.includes(userId) && userId !== session.callerId) {
      throw new Error('User not authorized');
    }
    if (session.status !== CallStatus.RINGING) throw new Error('Call is not ringing');
    session.status = CallStatus.REJECTED;
    session.endedAt = Date.now();
    session.endedBy = userId;
    this.conversationCalls.delete(session.conversationId);
    return session;
  }

  endCall(callId: string, userId: string): CallSession {
    const session = this.activeCalls.get(callId);
    if (!session) throw new Error('Call not found');
    if (userId !== session.callerId && !session.calleeIds.includes(userId)) {
      throw new Error('User not authorized to end this call');
    }
    if (
      session.status === CallStatus.ENDED ||
      session.status === CallStatus.CANCELLED ||
      session.status === CallStatus.MISSED ||
      session.status === CallStatus.REJECTED
    ) {
      throw new Error('Call has already ended');
    }
    session.status = session.answeredAt ? CallStatus.ENDED : CallStatus.CANCELLED;
    session.endedAt = Date.now();
    session.endedBy = userId;
    this.conversationCalls.delete(session.conversationId);
    return session;
  }

  markMissed(callId: string, userId: string): CallSession {
    const session = this.activeCalls.get(callId);
    if (!session) throw new Error('Call not found');
    if (userId !== session.callerId && !session.calleeIds.includes(userId)) {
      throw new Error('User not authorized');
    }
    if (session.status !== CallStatus.RINGING) throw new Error('Call is not ringing');
    session.status = CallStatus.MISSED;
    session.endedAt = Date.now();
    session.endedBy = userId;
    this.conversationCalls.delete(session.conversationId);
    return session;
  }

  markLogged(callId: string, messageId: string): void {
    const session = this.activeCalls.get(callId);
    if (session) {
      session.loggedMessageId = messageId;
    }
  }

  getCall(callId: string): CallSession | undefined {
    return this.activeCalls.get(callId);
  }

  getActiveCallByConversation(conversationId: string): CallSession | undefined {
    const callId = this.conversationCalls.get(conversationId);
    if (!callId) return undefined;
    return this.activeCalls.get(callId);
  }

  isCallActiveInConversation(conversationId: string): boolean {
    const call = this.getActiveCallByConversation(conversationId);
    return !!call && (call.status === CallStatus.RINGING || call.status === CallStatus.ANSWERED);
  }
}

export const callService = new CallService();
