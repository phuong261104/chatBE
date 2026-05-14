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
}
