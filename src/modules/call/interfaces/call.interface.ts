export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallStatus {
  RINGING = 'ringing',
  ANSWERED = 'answered',
  REJECTED = 'rejected',
  ENDED = 'ended',
  MISSED = 'missed',
}

export interface CallSession {
  callId: string;
  callerId: string;
  calleeIds: string[];
  type: CallType;
  status: CallStatus;
  conversationId: string;
  roomName: string;
  createdAt: number;
  answeredAt?: number;
  endedAt?: number;
}
