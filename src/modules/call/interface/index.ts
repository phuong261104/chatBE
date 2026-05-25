import {
  Conversation,
  ConversationCondDTO,
  ConversationMember,
  ConversationMemberCondDTO,
  Message,
} from '@modules/chat';
import { Block, BlockCondDTO } from '@modules/blocks';
import { CallSession, TerminalCallLogStatus } from '../model';

export * from '../model';

export interface ICallConversationRepository {
  get(id: string): Promise<Conversation | null>;
  findByCond(cond: ConversationCondDTO): Promise<Conversation | null>;
}

export interface ICallConversationMemberRepository {
  findByCond(cond: ConversationMemberCondDTO): Promise<ConversationMember | null>;
  listByConversationId(conversationId: string): Promise<ConversationMember[]>;
}

export interface ICallBlockRepository {
  findByCond(cond: BlockCondDTO): Promise<Block | null>;
}

export interface ICallLogService {
  createTerminalLog(
    session: CallSession,
    status: TerminalCallLogStatus,
    endedBy?: string,
  ): Promise<Message | null>;
}

export interface ICallSocketNotifier {
  notifyIncomingCall(userId: string, callData: unknown): void;
  notifyOngoingCall(userId: string, callData: unknown): void;
  notifyJoined(callId: string, payload: unknown): void;
  notifyLeft(callId: string, payload: unknown): void;
  notifyDeclined(callId: string, payload: unknown): void;
  notifyMissed(callId: string, payload: unknown): void;
  notifyBusy(userId: string, payload: unknown): void;
  notifyEnded(callId: string, payload: unknown): void;
  emitToUser(userId: string, event: string, payload: unknown): void;
  emitToCall(callId: string, event: string, payload: unknown): void;
}
