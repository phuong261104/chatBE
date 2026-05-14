import { Server as SocketIOServer } from 'socket.io';
import { ServiceContext } from "@share/interface/service-context";
import { CallController, setupCallRoutes } from './infras/transport/http';
import { CallSocketService } from './infras';
import {
  DynamoConversationMemberRepository,
  DynamoConversationRepository,
  DynamoMessageRepository,
  MessagingSocketService,
} from '@modules/chat';
import { CallLogService } from './usecase';

export { CallSocketService } from './infras';
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
