/**
 * Chat Module Entry Point (Infrastructure Layer)
 *
 * This is the module's BOUNDARY with external systems.
 * Following Hexagonal Architecture and DDD Bounded Context:
 * - This module owns: conversations, conversation-members, and messages
 * - This layer wires up dependencies (Dependency Injection)
 * - Domain and Use Case layers remain pure and independent
 */

// ==================== Framework & Infrastructure ====================
import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { ServiceContext } from '@/share/interface/service-context';

// ==================== External Dependencies (User Module) ====================
import { MongoUserRepository } from '@modules/user/infras/repository/nosql/mongodb-repo';
import { UserUseCase } from '@modules/user/usecase';

// ==================== Chat Module Components (using barrel exports) ====================
// Infrastructure: Repositories & Transport
import {
  MongoConversationRepository,
  MongoConversationMemberRepository,
  MongoMessageRepository,
  UserRepositoryAdapter,
  MessagingHttpService,
  MessagingSocketService
} from './infras';

// Use Cases: All handlers and facade
import {
  GetOrCreatePrivateConversationHandler,
  SendMessageHandler,
  CreateGroupHandler,
  SendGroupMessageHandler,
  AddMembersToGroupHandler,
  RemoveMemberFromGroupHandler,
  UpdateGroupInfoHandler,
  MarkAsSeenHandler,
  MarkAsDeliveredHandler,
  LeaveGroupHandler,
  GetConversationsQueryHandler,
  GetConversationDetailQueryHandler,
  GetConversationMembersQueryHandler,
  LoadMessagesQueryHandler,
  GetTotalUnreadCountQueryHandler,
  GetGroupMembersQueryHandler,
  MessagingUseCaseFacade
} from './usecase';

export const setupMessagingHexagon = (io: SocketIOServer, sctx: ServiceContext) => {
  const mdlFactory = sctx.mdlFactory;

  const conversationRepo = new MongoConversationRepository();
  const conversationMemberRepo = new MongoConversationMemberRepository();
  const messageRepo = new MongoMessageRepository();

  const userRepo = new MongoUserRepository();
  const userUseCase = new UserUseCase(userRepo);
  const userAdapter = new UserRepositoryAdapter(userUseCase);

  const getOrCreatePrivateConversationHandler = new GetOrCreatePrivateConversationHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    userAdapter
  );

  const sendMessageHandler = new SendMessageHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    conversationRepo
  );

  const createGroupHandler = new CreateGroupHandler(conversationRepo, conversationMemberRepo, messageRepo, userAdapter);

  const sendGroupMessageHandler = new SendGroupMessageHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    conversationRepo
  );

  const addMembersToGroupHandler = new AddMembersToGroupHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter
  );

  const removeMemberFromGroupHandler = new RemoveMemberFromGroupHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter
  );

  const updateGroupInfoHandler = new UpdateGroupInfoHandler(conversationRepo, conversationRepo, conversationMemberRepo);

  const markAsSeenHandler = new MarkAsSeenHandler(conversationMemberRepo, conversationMemberRepo, messageRepo);

  const markAsDeliveredHandler = new MarkAsDeliveredHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo
  );

  const leaveGroupHandler = new LeaveGroupHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter
  );

  const getConversationsQueryHandler = new GetConversationsQueryHandler(conversationRepo, conversationMemberRepo);

  const getConversationDetailQueryHandler = new GetConversationDetailQueryHandler(
    conversationRepo,
    conversationMemberRepo
  );

  const getConversationMembersQueryHandler = new GetConversationMembersQueryHandler(conversationMemberRepo);

  const loadMessagesQueryHandler = new LoadMessagesQueryHandler(conversationMemberRepo, messageRepo);

  const getTotalUnreadCountQueryHandler = new GetTotalUnreadCountQueryHandler(conversationMemberRepo);

  const getGroupMembersQueryHandler = new GetGroupMembersQueryHandler(conversationRepo, conversationMemberRepo);

  const useCase = new MessagingUseCaseFacade(
    getOrCreatePrivateConversationHandler,
    sendMessageHandler,
    createGroupHandler,
    sendGroupMessageHandler,
    addMembersToGroupHandler,
    removeMemberFromGroupHandler,
    updateGroupInfoHandler,
    markAsSeenHandler,
    markAsDeliveredHandler,
    leaveGroupHandler,
    getConversationsQueryHandler,
    getConversationDetailQueryHandler,
    getConversationMembersQueryHandler,
    loadMessagesQueryHandler,
    getTotalUnreadCountQueryHandler,
    getGroupMembersQueryHandler
  );

  const httpService = new MessagingHttpService(useCase);
  const socketService = new MessagingSocketService(io, useCase);

  httpService.setSocketService(socketService);

  const router = Router();

  router.get('/conversations/private', mdlFactory.auth, httpService.getPrivateConversationAPI.bind(httpService));
  router.get('/conversations/unread-count', mdlFactory.auth, httpService.getTotalUnreadCountAPI.bind(httpService));
  router.get('/conversations', mdlFactory.auth, httpService.getConversationsAPI.bind(httpService));
  router.get('/conversations/:conversationId', mdlFactory.auth, httpService.getConversationDetailAPI.bind(httpService));
  router.get('/conversations/:conversationId/messages', mdlFactory.auth, httpService.loadMessagesAPI.bind(httpService));

  router.post('/conversations/:conversationId/messages', mdlFactory.auth, httpService.sendMessageAPI.bind(httpService));

  router.post('/conversations/:conversationId/seen', mdlFactory.auth, httpService.markAsSeenAPI.bind(httpService));
  router.post(
    '/conversations/:conversationId/delivered',
    mdlFactory.auth,
    httpService.markAsDeliveredAPI.bind(httpService)
  );

  router.post('/groups', mdlFactory.auth, httpService.createGroupAPI.bind(httpService));
  router.post('/groups/:groupId/members', mdlFactory.auth, httpService.addMembersAPI.bind(httpService));
  router.delete('/groups/:groupId/members/:userId', mdlFactory.auth, httpService.removeMemberAPI.bind(httpService));
  router.put('/groups/:groupId', mdlFactory.auth, httpService.updateGroupAPI.bind(httpService));
  router.post('/groups/:groupId/leave', mdlFactory.auth, httpService.leaveGroupAPI.bind(httpService));
  router.get('/groups/:groupId/members', mdlFactory.auth, httpService.getGroupMembersAPI.bind(httpService));

  return {
    router,
    socketService
  };
};

// ==================== Public Exports ====================
// Export models, DTOs, and interfaces for other modules that need to interact with Chat

// Models & DTOs
export * from './model';

// Interfaces (Repository & UseCase interfaces)
export * from './interface';

// Repositories (for modules that need direct data access)
export {
  MongoConversationRepository,
  MongoConversationMemberRepository,
  MongoMessageRepository,
  ConversationModel,
  ConversationMemberModel,
  MessageModel
} from './infras';
