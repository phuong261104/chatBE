import { v4 as uuidv4 } from 'uuid';
import { CallSession, CallStatus, CallType, LivekitProvider } from '../interface';

export enum CallV2ParticipantStatus {
  INVITED = 'invited',
  RINGING = 'ringing',
  JOINED = 'joined',
  DECLINED = 'declined',
  MISSED = 'missed',
  LEFT = 'left',
  BUSY = 'busy',
}

export enum CallV2SessionStatus {
  RINGING = 'ringing',
  IN_CALL = 'in-call',
  ENDED = 'ended',
  MISSED = 'missed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface CallV2Participant {
  userId: string;
  status: CallV2ParticipantStatus;
  invitedAt?: number;
  joinedAt?: number;
  leftAt?: number;
  endedAt?: number;
}

export interface CallV2Session {
  callId: string;
  callerId: string;
  conversationId: string;
  type: CallType;
  isGroup: boolean;
  livekitProvider: LivekitProvider;
  roomName: string;
  status: CallV2SessionStatus;
  createdAt: number;
  answeredAt?: number;
  endedAt?: number;
  endedBy?: string;
  calleeIds: string[];
  participants: Record<string, CallV2Participant>;
  busyUserIds: string[];
  loggedMessageId?: string;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

export interface CreateCallV2Input {
  callerId: string;
  conversationId: string;
  type: CallType;
  calleeIds: string[];
  isGroup: boolean;
  livekitProvider?: LivekitProvider;
}

export interface CreateCallV2Result {
  session: CallV2Session;
  invitedUserIds: string[];
  busyUserIds: string[];
}

type TimeoutHandler = (
  session: CallV2Session,
  missedUserIds: string[],
  terminal: boolean,
) => void | Promise<void>;

class CallV2Service {
  private readonly timeoutMs = Number(process.env.CALL_V2_TIMEOUT_MS || 60_000);
  private activeCalls: Map<string, CallV2Session> = new Map();
  private conversationCalls: Map<string, string> = new Map();
  private userCalls: Map<string, string> = new Map();
  private timeoutHandler?: TimeoutHandler;

  setTimeoutHandler(handler: TimeoutHandler) {
    this.timeoutHandler = handler;
  }

  createCall(input: CreateCallV2Input): CreateCallV2Result {
    this.assertNoActiveConversationCall(input.conversationId);
    const busyUserIds = input.calleeIds.filter((userId) => this.isUserBusy(userId));
    const invitedUserIds = input.calleeIds.filter((userId) => !busyUserIds.includes(userId));

    const callId = uuidv4();
    const roomName = `call-v2-${input.conversationId}-${callId.substring(0, 8)}`;
    const now = Date.now();
    const participants: Record<string, CallV2Participant> = {
      [input.callerId]: {
        userId: input.callerId,
        status: CallV2ParticipantStatus.JOINED,
        joinedAt: now,
      },
    };

    for (const userId of invitedUserIds) {
      participants[userId] = {
        userId,
        status: CallV2ParticipantStatus.RINGING,
        invitedAt: now,
      };
    }
    for (const userId of busyUserIds) {
      participants[userId] = {
        userId,
        status: CallV2ParticipantStatus.BUSY,
        invitedAt: now,
        endedAt: now,
      };
    }

    const privateBusy = !input.isGroup && busyUserIds.length > 0;
    const session: CallV2Session = {
      callId,
      callerId: input.callerId,
      conversationId: input.conversationId,
      type: input.type,
      isGroup: input.isGroup,
      livekitProvider: input.livekitProvider ?? LivekitProvider.CLOUD,
      roomName,
      status: privateBusy ? CallV2SessionStatus.MISSED : CallV2SessionStatus.RINGING,
      createdAt: now,
      endedAt: privateBusy ? now : undefined,
      endedBy: privateBusy ? input.callerId : undefined,
      calleeIds: input.calleeIds,
      participants,
      busyUserIds,
    };

    if (!privateBusy) {
      this.activeCalls.set(callId, session);
      this.conversationCalls.set(input.conversationId, callId);
      this.userCalls.set(input.callerId, callId);
      for (const userId of invitedUserIds) {
        this.userCalls.set(userId, callId);
      }
      session.timeoutHandle = setTimeout(() => {
        void this.handleTimeout(callId);
      }, this.timeoutMs);
    }

    return { session, invitedUserIds, busyUserIds };
  }

  joinCall(callId: string, userId: string): CallV2Session {
    const session = this.requireCall(callId);
    this.assertNotTerminal(session);
    const busyCallId = this.userCalls.get(userId);
    if (busyCallId && busyCallId !== callId) {
      throw this.error('User is busy in another call', 409);
    }

    const now = Date.now();
    const participant = session.participants[userId] ?? {
      userId,
      status: CallV2ParticipantStatus.INVITED,
      invitedAt: now,
    };
    participant.status = CallV2ParticipantStatus.JOINED;
    participant.joinedAt = participant.joinedAt ?? now;
    participant.leftAt = undefined;
    participant.endedAt = undefined;
    session.participants[userId] = participant;

    if (!session.answeredAt) {
      session.answeredAt = now;
    }
    session.status = CallV2SessionStatus.IN_CALL;
    this.userCalls.set(userId, callId);
    return session;
  }

  rejectCall(callId: string, userId: string): { session: CallV2Session; terminal: boolean } {
    const session = this.requireCall(callId);
    this.assertParticipant(session, userId);
    this.assertNotTerminal(session);

    const now = Date.now();
    session.participants[userId] = {
      ...session.participants[userId],
      status: CallV2ParticipantStatus.DECLINED,
      endedAt: now,
    };
    this.releaseUser(userId, callId);

    const terminal =
      !session.isGroup ||
      (!this.hasJoinedParticipant(session, false) && !this.hasRingingParticipant(session));

    if (terminal) {
      session.status = CallV2SessionStatus.REJECTED;
      session.endedAt = now;
      session.endedBy = userId;
      this.releaseSession(session);
    }

    return { session, terminal };
  }

  markMissed(callId: string, userId: string): { session: CallV2Session; terminal: boolean } {
    const session = this.requireCall(callId);
    this.assertParticipant(session, userId);
    this.assertNotTerminal(session);

    const now = Date.now();
    session.participants[userId] = {
      ...session.participants[userId],
      status: CallV2ParticipantStatus.MISSED,
      endedAt: now,
    };
    this.releaseUser(userId, callId);

    const terminal =
      !session.isGroup ||
      (!this.hasJoinedParticipant(session, false) && !this.hasRingingParticipant(session));

    if (terminal) {
      session.status = CallV2SessionStatus.MISSED;
      session.endedAt = now;
      session.endedBy = userId;
      this.releaseSession(session);
    }

    return { session, terminal };
  }

  leaveCall(callId: string, userId: string): { session: CallV2Session; terminal: boolean } {
    const session = this.requireCall(callId);
    this.assertParticipant(session, userId);
    this.assertNotTerminal(session);

    const now = Date.now();
    session.participants[userId] = {
      ...session.participants[userId],
      status: CallV2ParticipantStatus.LEFT,
      leftAt: now,
      endedAt: now,
    };
    this.releaseUser(userId, callId);

    const terminal = !this.hasJoinedParticipant(session, true) || !session.isGroup;
    if (terminal) {
      session.status = session.answeredAt
        ? CallV2SessionStatus.ENDED
        : CallV2SessionStatus.CANCELLED;
      session.endedAt = now;
      session.endedBy = userId;
      this.releaseSession(session);
    }

    return { session, terminal };
  }

  endCall(callId: string, userId: string): CallV2Session {
    const session = this.requireCall(callId);
    this.assertParticipant(session, userId);
    this.assertNotTerminal(session);

    const now = Date.now();
    for (const participant of Object.values(session.participants)) {
      if (
        participant.status === CallV2ParticipantStatus.RINGING ||
        participant.status === CallV2ParticipantStatus.INVITED
      ) {
        participant.status = CallV2ParticipantStatus.MISSED;
        participant.endedAt = now;
      } else if (participant.status === CallV2ParticipantStatus.JOINED) {
        participant.status = CallV2ParticipantStatus.LEFT;
        participant.leftAt = now;
        participant.endedAt = now;
      }
    }
    session.status = session.answeredAt
      ? CallV2SessionStatus.ENDED
      : CallV2SessionStatus.CANCELLED;
    session.endedAt = now;
    session.endedBy = userId;
    this.releaseSession(session);
    return session;
  }

  getCall(callId: string): CallV2Session | undefined {
    return this.activeCalls.get(callId);
  }

  getActiveCallByConversation(conversationId: string): CallV2Session | undefined {
    const callId = this.conversationCalls.get(conversationId);
    return callId ? this.activeCalls.get(callId) : undefined;
  }

  markLogged(callId: string, messageId: string): void {
    const session = this.activeCalls.get(callId);
    if (session) {
      session.loggedMessageId = messageId;
    }
  }

  resetForTests(): void {
    for (const session of this.activeCalls.values()) {
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }
    }
    this.activeCalls.clear();
    this.conversationCalls.clear();
    this.userCalls.clear();
    this.timeoutHandler = undefined;
  }

  toLegacySession(session: CallV2Session): CallSession {
    return {
      callId: session.callId,
      callerId: session.callerId,
      calleeIds: session.calleeIds,
      type: session.type,
      status: this.toLegacyStatus(session.status),
      livekitProvider: session.livekitProvider,
      conversationId: session.conversationId,
      roomName: session.roomName,
      createdAt: session.createdAt,
      answeredAt: session.answeredAt,
      endedAt: session.endedAt,
      endedBy: session.endedBy,
      loggedMessageId: session.loggedMessageId,
      participantOutcomes: Object.fromEntries(
        Object.entries(session.participants).map(([userId, participant]) => [
          userId,
          {
            status: participant.status,
            joinedAt: participant.joinedAt,
            leftAt: participant.leftAt,
            endedAt: participant.endedAt,
          },
        ]),
      ),
    };
  }

  toResponse(session: CallV2Session) {
    const { timeoutHandle, ...data } = session;
    return data;
  }

  private async handleTimeout(callId: string) {
    const session = this.activeCalls.get(callId);
    if (!session || this.isTerminal(session)) {
      return;
    }

    const now = Date.now();
    const missedUserIds: string[] = [];
    for (const participant of Object.values(session.participants)) {
      if (
        participant.status === CallV2ParticipantStatus.RINGING ||
        participant.status === CallV2ParticipantStatus.INVITED
      ) {
        participant.status = CallV2ParticipantStatus.MISSED;
        participant.endedAt = now;
        missedUserIds.push(participant.userId);
        this.releaseUser(participant.userId, callId);
      }
    }

    const terminal = !this.hasEverJoinedCallee(session);
    if (terminal) {
      session.status = CallV2SessionStatus.MISSED;
      session.endedAt = now;
      session.endedBy = 'timeout';
      this.releaseSession(session);
    } else {
      session.status = CallV2SessionStatus.IN_CALL;
    }

    await this.timeoutHandler?.(session, missedUserIds, terminal);
  }

  private assertNoActiveConversationCall(conversationId: string) {
    const existing = this.getActiveCallByConversation(conversationId);
    if (existing && !this.isTerminal(existing)) {
      throw this.error('A v2 call is already active in this conversation', 409);
    }
  }

  private assertParticipant(session: CallV2Session, userId: string) {
    if (!session.participants[userId]) {
      throw this.error('User is not a participant in this call', 403);
    }
  }

  private assertNotTerminal(session: CallV2Session) {
    if (this.isTerminal(session)) {
      throw this.error('Call has already ended', 400);
    }
  }

  private requireCall(callId: string): CallV2Session {
    const session = this.activeCalls.get(callId);
    if (!session) {
      throw this.error('Call not found', 404);
    }
    return session;
  }

  private isTerminal(session: CallV2Session) {
    return [
      CallV2SessionStatus.ENDED,
      CallV2SessionStatus.MISSED,
      CallV2SessionStatus.REJECTED,
      CallV2SessionStatus.CANCELLED,
    ].includes(session.status);
  }

  private isUserBusy(userId: string): boolean {
    const callId = this.userCalls.get(userId);
    if (!callId) {
      return false;
    }
    const session = this.activeCalls.get(callId);
    return !!session && !this.isTerminal(session);
  }

  private hasJoinedParticipant(session: CallV2Session, includeCaller: boolean) {
    return Object.values(session.participants).some((participant) => {
      if (!includeCaller && participant.userId === session.callerId) {
        return false;
      }
      return participant.status === CallV2ParticipantStatus.JOINED;
    });
  }

  private hasEverJoinedCallee(session: CallV2Session) {
    return Object.values(session.participants).some(
      (participant) => participant.userId !== session.callerId && !!participant.joinedAt,
    );
  }

  private hasRingingParticipant(session: CallV2Session) {
    return Object.values(session.participants).some((participant) =>
      [CallV2ParticipantStatus.RINGING, CallV2ParticipantStatus.INVITED].includes(
        participant.status,
      ),
    );
  }

  private releaseSession(session: CallV2Session) {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = undefined;
    }
    this.conversationCalls.delete(session.conversationId);
    for (const userId of Object.keys(session.participants)) {
      this.releaseUser(userId, session.callId);
    }
  }

  private releaseUser(userId: string, callId: string) {
    if (this.userCalls.get(userId) === callId) {
      this.userCalls.delete(userId);
    }
  }

  private toLegacyStatus(status: CallV2SessionStatus): CallStatus {
    if (status === CallV2SessionStatus.IN_CALL) return CallStatus.ANSWERED;
    if (status === CallV2SessionStatus.ENDED) return CallStatus.ENDED;
    if (status === CallV2SessionStatus.MISSED) return CallStatus.MISSED;
    if (status === CallV2SessionStatus.REJECTED) return CallStatus.REJECTED;
    if (status === CallV2SessionStatus.CANCELLED) return CallStatus.CANCELLED;
    return CallStatus.RINGING;
  }

  private error(message: string, statusCode: number) {
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = statusCode;
    return err;
  }
}

export const callV2Service = new CallV2Service();
