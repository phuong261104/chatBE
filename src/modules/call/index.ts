import { Server as SocketIOServer } from 'socket.io';
import { ServiceContext } from "@share/interface/service-context";
import {
  CallController,
  CallV2Controller,
  setupCallRoutes,
  setupCallV2Routes,
} from './infras/transport/http';
import { CallSocketService, CallV2SocketService } from './infras';
import {
  DynamoConversationMemberRepository,
  DynamoConversationRepository,
  DynamoMessageRepository,
  MessagingSocketService,
} from '@modules/chat';
import { DynamoBlockRepository } from '@modules/blocks/infras/repository/dynamodb';
import { CallLogService } from './usecase';

export { CallSocketService, CallV2SocketService } from './infras';
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

  const controller = new CallController(conversationMemberRepo, callLogService);
  const socketService = new CallSocketService(io);
  controller.setSocketService(socketService);

  const v2Controller = new CallV2Controller(
    conversationRepo,
    conversationMemberRepo,
    blockRepo,
    callLogService,
  );
  const v2SocketService = new CallV2SocketService(io);
  v2Controller.setSocketService(v2SocketService);

  const router = setupCallRoutes(controller, sctx.mdlFactory);
  const v2Router = setupCallV2Routes(v2Controller, sctx.mdlFactory);

  return { router, v2Router, socketService, v2SocketService };
};
