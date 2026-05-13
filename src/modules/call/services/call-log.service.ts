import { v7 } from 'uuid';
import {
  CallMessageMetadata,
  ConversationMemberStatus,
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
  IMessageCommandRepository,
  Message,
  MessageType,
} from '@modules/chat';
import { SocketEvent } from '@modules/chat/constants/socket-events';
import { CallSession, CallType } from '../interfaces/call.interface';

export type TerminalCallLogStatus =
  | 'completed'
  | 'missed'
  | 'rejected'
  | 'cancelled';

export interface CallLogMessageEmitter {
  emitToUser(userId: string, event: string, data: unknown): void;
}

export class CallLogService {
  constructor(
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageEmitter?: CallLogMessageEmitter,
  ) {}

  async createTerminalLog(
    session: CallSession,
    status: TerminalCallLogStatus,
    endedBy?: string,
  ): Promise<Message | null> {
    if (session.loggedMessageId) {
      return null;
    }

    const endedAt = new Date(session.endedAt ?? Date.now());
    const answeredAt = session.answeredAt ? new Date(session.answeredAt) : undefined;
    const durationSeconds =
      status === 'completed' && session.answeredAt
        ? Math.max(0, Math.round(((session.endedAt ?? Date.now()) - session.answeredAt) / 1000))
        : undefined;

    const call: CallMessageMetadata = {
      callId: session.callId,
      roomName: session.roomName,
      callType: session.type,
      status,
      callerId: session.callerId,
      calleeIds: session.calleeIds,
      answeredAt,
      endedAt,
      endedBy: endedBy ?? session.endedBy,
      durationSeconds,
    };
    const textPreview = this.getTextPreview(call);
    const message: Message = {
      id: v7(),
      conversationId: session.conversationId,
      senderId: session.callerId,
      type: MessageType.CALL,
      text: textPreview,
      call,
      createdAt: endedAt,
      pinned: false,
    };

    await this.messageCommandRepo.insert(message);
    session.loggedMessageId = message.id;

    await this.conversationCommandRepo.update(session.conversationId, {
      lastMessage: {
        messageId: message.id,
        senderId: message.senderId,
        type: MessageType.CALL,
        textPreview,
        createdAt: message.createdAt,
      },
      lastMessageAt: message.createdAt,
    });

    if (status === 'missed') {
      await this.conversationMemberCommandRepo.incrementUnreadCountForConversation(
        session.conversationId,
        session.callerId,
      );
    }

    await this.emitMessage(message);
    return message;
  }

  private async emitMessage(message: Message) {
    if (!this.messageEmitter) return;

    const members = await this.conversationMemberQueryRepo.listByConversationId(
      message.conversationId,
    );

    for (const member of members) {
      if (member.status !== ConversationMemberStatus.ACTIVE || member.leftAt) {
        continue;
      }
      this.messageEmitter.emitToUser(member.userId, SocketEvent.RECEIVE_MESSAGE, {
        message,
        conversationId: message.conversationId,
      });
    }
  }

  private getTextPreview(call: CallMessageMetadata): string {
    const typeText = call.callType === CallType.VIDEO ? 'video' : 'thoại';
    if (call.status === 'completed') {
      return `Cuộc gọi ${typeText} ${this.formatDuration(call.durationSeconds ?? 0)}`;
    }
    if (call.status === 'missed') {
      return `Cuộc gọi ${typeText} nhỡ`;
    }
    if (call.status === 'rejected') {
      return 'Cuộc gọi bị từ chối';
    }
    return 'Cuộc gọi đã hủy';
  }

  private formatDuration(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
}
