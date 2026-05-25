export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallStatus {
  RINGING = 'ringing',
  ANSWERED = 'answered',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  ENDED = 'ended',
  MISSED = 'missed',
}

export enum LivekitProvider {
  SELF_HOSTED = 'self-hosted',
  CLOUD = 'cloud',
}

export type TerminalCallLogStatus =
  | 'completed'
  | 'missed'
  | 'rejected'
  | 'cancelled';

export interface CallSession {
  callId: string;
  callerId: string;
  calleeIds: string[];
  type: CallType;
  status: CallStatus;
  livekitProvider: LivekitProvider;
  conversationId: string;
  roomName: string;
  createdAt: number;
  answeredAt?: number;
  endedAt?: number;
  endedBy?: string;
  loggedMessageId?: string;
  participantOutcomes?: Record<
    string,
    {
      status: string;
      joinedAt?: number | Date;
      leftAt?: number | Date;
      endedAt?: number | Date;
    }
  >;
}

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

export type CallV2PublicSession = Omit<CallV2Session, 'timeoutHandle'>;

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
