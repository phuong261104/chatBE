import { Server as SocketIOServer } from 'socket.io';
import { ServiceContext } from "@share/interface/service-context";
import {
  CallV2Controller,
  setupCallV2Routes,
} from './infras/transport/http';
import { CallV2SocketService } from './infras';
import {
  DynamoConversationMemberRepository,
  DynamoConversationRepository,
  DynamoMessageRepository,
  MessagingSocketService,
} from '@modules/chat';
import { DynamoBlockRepository } from '@modules/blocks/infras/repository/dynamodb';
import { CallLogService } from './usecase';

export { CallV2SocketService } from './infras';
export * from './interface';
export * from './model';
export * from './usecase';

export const setupCallHexagon = (
  io: SocketIOServer,
  sctx: ServiceContext,
  messagingSocketService?: MessagingSocketService,
) => {
  const conversationMemberRepo = new DynamoConversationMemberRepository();
  const conversationRepo = new DynamoConversationRepository();
  const messageRepo = new DynamoMessageRepository();
  const blockRepo = new DynamoBlockRepository();
  const callLogService = new CallLogService(
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messagingSocketService,
  );

  const v2Controller = new CallV2Controller(
    conversationRepo,
    conversationMemberRepo,
    blockRepo,
    callLogService,
  );
  const v2SocketService = new CallV2SocketService(io);
  v2Controller.setSocketService(v2SocketService);

  const router = setupCallV2Routes(v2Controller, sctx.mdlFactory);

  return { router, socketService: v2SocketService };
};
