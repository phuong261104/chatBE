import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { ServiceContext } from "@share/interface/service-context";
import { CallController } from './controller/call.controller';
import { CallSocketService } from './infras';
import { setupCallRoutes } from './routes/call.routes';
import { DynamoConversationMemberRepository } from '@modules/chat';

export { CallSocketService } from './infras';

export const setupCallHexagon = (io: SocketIOServer, sctx: ServiceContext) => {
  const conversationMemberRepo = new DynamoConversationMemberRepository();

  const controller = new CallController(conversationMemberRepo);
  const socketService = new CallSocketService(io);
  controller.setSocketService(socketService);

  const router = setupCallRoutes(controller, sctx.mdlFactory);

  return { router, socketService };
};
