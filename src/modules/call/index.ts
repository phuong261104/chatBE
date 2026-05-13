import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { ServiceContext } from "@share/interface/service-context";
import { CallController } from './controller/call.controller';
import { CallSocketService } from './infras';
import { setupCallRoutes } from './routes/call.routes';
import {
  DynamoConversationMemberRepository,
  DynamoConversationRepository,
  DynamoMessageRepository,
  MessagingSocketService,
} from '@modules/chat';
import { CallLogService } from './services/call-log.service';

export { CallSocketService } from './infras';

export const setupCallHexagon = (
  io: SocketIOServer,
  sctx: ServiceContext,
  messagingSocketService?: MessagingSocketService,
) => {
  const conversationMemberRepo = new DynamoConversationMemberRepository();
  const conversationRepo = new DynamoConversationRepository();
  const messageRepo = new DynamoMessageRepository();
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

  const router = setupCallRoutes(controller, sctx.mdlFactory);

  return { router, socketService };
};
