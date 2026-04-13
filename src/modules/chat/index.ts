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
import { Router } from "express";
import { Server as SocketIOServer } from "socket.io";
import { ServiceContext } from "@/share/interface/service-context";

// ==================== External Dependencies (User Module) ====================
import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb/dynamodb-repo";
import { MongoUserRepository } from "@modules/user/infras/repository/nosql/mongodb-repo";
import { UserUseCase } from "@modules/user/usecase";

// ==================== Chat Module Components (using barrel exports) ====================
// Infrastructure: Repositories & Transport
import {
  MongoConversationRepository,
  MongoConversationMemberRepository,
  MongoMessageRepository,
  MongoMessageReactionQueryRepository,
  MongoMessageReactionCommandRepository,
  MongoPollQueryRepository,
  MongoPollCommandRepository,
  UserRepositoryAdapter,
  MessagingHttpService,
  MessagingSocketService,
} from "./infras";

// ==================== DynamoDB Repositories ====================
import {
  DynamoConversationRepository,
  DynamoConversationMemberRepository,
  DynamoMessageRepository,
  DynamoMessageReactionQueryRepository,
  DynamoMessageReactionCommandRepository,
  DynamoPollQueryRepository,
  DynamoPollCommandRepository,
  DynamoMessageClassificationRepository,
} from "./infras/repository/dynamodb";

import { config } from "@share/component/config";

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
  RevokeMessageHandler,
  DeleteMessageForMeHandler,
  DeleteMessageForEveryoneHandler,
  ForwardMessagesHandler,
  MuteConversationHandler,
  UnmuteConversationHandler,
  PinConversationHandler,
  UnpinConversationHandler,
  ArchiveConversationHandler,
  UnarchiveConversationHandler,
  EditMessageHandler,
  PinMessageHandler,
  UnpinMessageHandler,
  GetPinnedMessagesHandler,
  MessagingUseCaseFacade,
  AddReactionHandler,
  RemoveReactionHandler,
  RemoveAllReactionsHandler,
  GetReactionsHandler,
  QuoteMessageHandler,
  SetAdminHandler,
  TransferOwnerHandler,
  CreatePollHandler,
  GetPollsHandler,
  VotePollHandler,
  GetPollResultsHandler,
  GetPendingMembersHandler,
  ApproveMemberHandler,
  RejectMemberHandler,
  UpdateGroupSettingsHandler,
  GetGroupInfoHandler,
  GetConversationMediaQueryHandler,
} from "./usecase";

export const setupMessagingHexagon = (io: SocketIOServer, sctx: ServiceContext) => {
  const mdlFactory = sctx.mdlFactory;

  const dbType = config.dbType;

  const conversationRepo = (
    dbType === "dynamodb" ? new DynamoConversationRepository() : new MongoConversationRepository()
  ) as any;
  const conversationMemberRepo = (
    dbType === "dynamodb" ? new DynamoConversationMemberRepository() : new MongoConversationMemberRepository()
  ) as any;
  const messageRepo = (dbType === "dynamodb" ? new DynamoMessageRepository() : new MongoMessageRepository()) as any;
  const reactionQueryRepo = (
    dbType === "dynamodb" ? new DynamoMessageReactionQueryRepository() : new MongoMessageReactionQueryRepository()
  ) as any;
  const reactionCmdRepo = (
    dbType === "dynamodb" ? new DynamoMessageReactionCommandRepository() : new MongoMessageReactionCommandRepository()
  ) as any;
  const pollQueryRepo = (
    dbType === "dynamodb" ? new DynamoPollQueryRepository() : new MongoPollQueryRepository()
  ) as any;
  const pollCmdRepo = (
    dbType === "dynamodb" ? new DynamoPollCommandRepository() : new MongoPollCommandRepository()
  ) as any;

  const classificationRepo = new DynamoMessageClassificationRepository();

  const userRepo = (dbType === "dynamodb" ? new DynamoUserRepository() : new MongoUserRepository()) as any;
  const userUseCase = new UserUseCase(userRepo);
  const userAdapter = new UserRepositoryAdapter(userUseCase);

  const getOrCreatePrivateConversationHandler = new GetOrCreatePrivateConversationHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    userAdapter,
  );

  const sendMessageHandler = new SendMessageHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    conversationRepo,
    classificationRepo,
  );

  const createGroupHandler = new CreateGroupHandler(conversationRepo, conversationMemberRepo, messageRepo, userAdapter);

  const sendGroupMessageHandler = new SendGroupMessageHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    conversationRepo,
    classificationRepo,
  );

  const addMembersToGroupHandler = new AddMembersToGroupHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
  );

  const removeMemberFromGroupHandler = new RemoveMemberFromGroupHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
  );

  const updateGroupInfoHandler = new UpdateGroupInfoHandler(conversationRepo, conversationRepo, conversationMemberRepo);

  const markAsSeenHandler = new MarkAsSeenHandler(conversationMemberRepo, conversationMemberRepo, messageRepo);

  const markAsDeliveredHandler = new MarkAsDeliveredHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
  );

  const leaveGroupHandler = new LeaveGroupHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
  );

  const getConversationsQueryHandler = new GetConversationsQueryHandler(
    conversationRepo,
    conversationMemberRepo,
    userAdapter,
  );

  const getConversationDetailQueryHandler = new GetConversationDetailQueryHandler(
    conversationRepo,
    conversationMemberRepo,
  );

  const getConversationMembersQueryHandler = new GetConversationMembersQueryHandler(conversationMemberRepo);

  const loadMessagesQueryHandler = new LoadMessagesQueryHandler(conversationMemberRepo, messageRepo);

  const getTotalUnreadCountQueryHandler = new GetTotalUnreadCountQueryHandler(conversationMemberRepo);

  const getGroupMembersQueryHandler = new GetGroupMembersQueryHandler(conversationRepo, conversationMemberRepo);

  const revokeMessageHandler = new RevokeMessageHandler(messageRepo, messageRepo, conversationMemberRepo);

  const deleteMessageForMeHandler = new DeleteMessageForMeHandler(messageRepo, messageRepo, conversationMemberRepo);

  const deleteMessageForEveryoneHandler = new DeleteMessageForEveryoneHandler(
    messageRepo,
    messageRepo,
    conversationMemberRepo,
  );

  const forwardMessagesHandler = new ForwardMessagesHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    messageRepo,
    classificationRepo,
  );

  const muteConversationHandler = new MuteConversationHandler(conversationMemberRepo, conversationMemberRepo);

  const unmuteConversationHandler = new UnmuteConversationHandler(conversationMemberRepo, conversationMemberRepo);

  const pinConversationHandler = new PinConversationHandler(conversationMemberRepo, conversationMemberRepo);

  const unpinConversationHandler = new UnpinConversationHandler(conversationMemberRepo, conversationMemberRepo);

  const archiveConversationHandler = new ArchiveConversationHandler(conversationMemberRepo, conversationMemberRepo);

  const unarchiveConversationHandler = new UnarchiveConversationHandler(conversationMemberRepo, conversationMemberRepo);

  const editMessageHandler = new EditMessageHandler(messageRepo, messageRepo, conversationMemberRepo);

  const pinMessageHandler = new PinMessageHandler(messageRepo, messageRepo, conversationMemberRepo);

  const unpinMessageHandler = new UnpinMessageHandler(messageRepo, messageRepo, conversationMemberRepo);

  const getPinnedMessagesHandler = new GetPinnedMessagesHandler(messageRepo, conversationMemberRepo);

  const addReactionHandler = new AddReactionHandler(
    messageRepo,
    reactionQueryRepo,
    reactionCmdRepo,
    conversationMemberRepo,
  );

  const removeReactionHandler = new RemoveReactionHandler(messageRepo, reactionCmdRepo);

  const removeAllReactionsHandler = new RemoveAllReactionsHandler(messageRepo, reactionCmdRepo);

  const getReactionsHandler = new GetReactionsHandler(messageRepo, reactionQueryRepo);

  const quoteMessageHandler = new QuoteMessageHandler(
    messageRepo,
    messageRepo,
    conversationMemberRepo,
    conversationRepo,
    classificationRepo,
  );

  const setAdminHandler = new SetAdminHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
  );

  const transferOwnerHandler = new TransferOwnerHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
  );

  const createPollHandler = new CreatePollHandler(conversationRepo, conversationMemberRepo, pollCmdRepo);

  const getPollsHandler = new GetPollsHandler(pollQueryRepo, conversationRepo, conversationMemberRepo);

  const votePollHandler = new VotePollHandler(pollQueryRepo, pollCmdRepo);

  const getPollResultsHandler = new GetPollResultsHandler(pollQueryRepo);

  const getPendingMembersHandler = new GetPendingMembersHandler(conversationRepo, conversationMemberRepo);

  const approveMemberHandler = new ApproveMemberHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
  );

  const rejectMemberHandler = new RejectMemberHandler(conversationRepo, conversationMemberRepo, conversationMemberRepo);

  const updateGroupSettingsHandler = new UpdateGroupSettingsHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
  );

  const getGroupInfoHandler = new GetGroupInfoHandler(conversationRepo, conversationMemberRepo);

  const getConversationMediaQueryHandler = new GetConversationMediaQueryHandler(
    conversationMemberRepo,
    classificationRepo,
  );

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
    getGroupMembersQueryHandler,
    revokeMessageHandler,
    deleteMessageForMeHandler,
    deleteMessageForEveryoneHandler,
    forwardMessagesHandler,
    muteConversationHandler,
    unmuteConversationHandler,
    pinConversationHandler,
    unpinConversationHandler,
    archiveConversationHandler,
    unarchiveConversationHandler,
    editMessageHandler,
    pinMessageHandler,
    unpinMessageHandler,
    getPinnedMessagesHandler,
    addReactionHandler,
    removeReactionHandler,
    removeAllReactionsHandler,
    getReactionsHandler,
    quoteMessageHandler,
    setAdminHandler,
    transferOwnerHandler,
    createPollHandler,
    getPollsHandler,
    votePollHandler,
    getPollResultsHandler,
    getPendingMembersHandler,
    approveMemberHandler,
    rejectMemberHandler,
    updateGroupSettingsHandler,
    getGroupInfoHandler,
    getConversationMediaQueryHandler,
  );

  const httpService = new MessagingHttpService(useCase);
  const socketService = new MessagingSocketService(io, useCase);

  httpService.setSocketService(socketService);

  const router = Router();

  router.post("/conversations/private", mdlFactory.auth, httpService.getPrivateConversationAPI.bind(httpService));
  router.get("/conversations/unread-count", mdlFactory.auth, httpService.getTotalUnreadCountAPI.bind(httpService));
  router.get("/conversations", mdlFactory.auth, httpService.getConversationsAPI.bind(httpService));
  router.get("/conversations/:conversationId", mdlFactory.auth, httpService.getConversationDetailAPI.bind(httpService));
  router.get("/conversations/:conversationId/messages", mdlFactory.auth, httpService.loadMessagesAPI.bind(httpService));

  router.post("/conversations/:conversationId/messages", mdlFactory.auth, httpService.sendMessageAPI.bind(httpService));

  router.post("/messages/:messageId/revoke", mdlFactory.auth, httpService.revokeMessageAPI.bind(httpService));

  router.post("/messages/:messageId/delete", mdlFactory.auth, httpService.deleteMessageForMeAPI.bind(httpService));

  router.post(
    "/messages/:messageId/delete-for-everyone",
    mdlFactory.auth,
    httpService.deleteMessageForEveryoneAPI.bind(httpService),
  );

  router.post("/messages/forward", mdlFactory.auth, httpService.forwardMessagesAPI.bind(httpService));

  router.post("/conversations/:conversationId/seen", mdlFactory.auth, httpService.markAsSeenAPI.bind(httpService));
  router.post(
    "/conversations/:conversationId/delivered",
    mdlFactory.auth,
    httpService.markAsDeliveredAPI.bind(httpService),
  );

  router.post("/groups", mdlFactory.auth, httpService.createGroupAPI.bind(httpService));
  router.post("/groups/:groupId/members", mdlFactory.auth, httpService.addMembersAPI.bind(httpService));
  router.delete("/groups/:groupId/members/:userId", mdlFactory.auth, httpService.removeMemberAPI.bind(httpService));
  router.put("/groups/:groupId", mdlFactory.auth, httpService.updateGroupAPI.bind(httpService));
  router.post("/groups/:groupId/leave", mdlFactory.auth, httpService.leaveGroupAPI.bind(httpService));
  router.get("/groups/:groupId/members", mdlFactory.auth, httpService.getGroupMembersAPI.bind(httpService));

  router.post(
    "/conversations/:conversationId/mute",
    mdlFactory.auth,
    httpService.muteConversationAPI.bind(httpService),
  );
  router.delete(
    "/conversations/:conversationId/mute",
    mdlFactory.auth,
    httpService.unmuteConversationAPI.bind(httpService),
  );

  router.post(
    "/conversations/:conversationId/pin-conversation",
    mdlFactory.auth,
    httpService.pinConversationAPI.bind(httpService),
  );
  router.delete(
    "/conversations/:conversationId/pin-conversation",
    mdlFactory.auth,
    httpService.unpinConversationAPI.bind(httpService),
  );

  router.post(
    "/conversations/:conversationId/archive",
    mdlFactory.auth,
    httpService.archiveConversationAPI.bind(httpService),
  );
  router.delete(
    "/conversations/:conversationId/archive",
    mdlFactory.auth,
    httpService.unarchiveConversationAPI.bind(httpService),
  );

  router.put("/messages/:messageId", mdlFactory.auth, httpService.editMessageAPI.bind(httpService));

  router.post("/messages/:messageId/pin", mdlFactory.auth, httpService.pinMessageAPI.bind(httpService));

  router.delete("/messages/:messageId/pin", mdlFactory.auth, httpService.unpinMessageAPI.bind(httpService));

  router.get(
    "/conversations/:conversationId/pinned-messages",
    mdlFactory.auth,
    httpService.getPinnedMessagesAPI.bind(httpService),
  );

  router.get(
    "/conversations/:conversationId/media",
    mdlFactory.auth,
    httpService.getConversationMediaAPI.bind(httpService),
  );

  router.post("/messages/:messageId/react", mdlFactory.auth, httpService.addReactionAPI.bind(httpService));

  router.delete("/messages/:messageId/react", mdlFactory.auth, httpService.removeReactionAPI.bind(httpService));

  router.delete("/messages/:messageId/reactions", mdlFactory.auth, httpService.removeAllReactionsAPI.bind(httpService));

  router.get("/messages/:messageId/reactions", mdlFactory.auth, httpService.getReactionsAPI.bind(httpService));

  router.post("/messages/:messageId/quote", mdlFactory.auth, httpService.quoteMessageAPI.bind(httpService));

  router.post("/groups/:groupId/set-admin", mdlFactory.auth, httpService.setAdminAPI.bind(httpService));

  router.post("/groups/:groupId/transfer-owner", mdlFactory.auth, httpService.transferOwnerAPI.bind(httpService));

  router.get("/groups/:groupId/members/pending", mdlFactory.auth, httpService.getPendingMembersAPI.bind(httpService));

  router.patch(
    "/groups/:groupId/members/:userId/approve",
    mdlFactory.auth,
    httpService.approveMemberAPI.bind(httpService),
  );

  router.patch(
    "/groups/:groupId/members/:userId/reject",
    mdlFactory.auth,
    httpService.rejectMemberAPI.bind(httpService),
  );

  router.patch("/groups/:groupId/settings", mdlFactory.auth, httpService.updateGroupSettingsAPI.bind(httpService));

  router.get("/groups/:groupId/info", mdlFactory.auth, httpService.getGroupInfoAPI.bind(httpService));

  router.post("/groups/:groupId/polls", mdlFactory.auth, httpService.createPollAPI.bind(httpService));

  router.get("/groups/:groupId/polls", mdlFactory.auth, httpService.getPollsAPI.bind(httpService));

  router.post("/groups/:groupId/polls/:pollId/vote", mdlFactory.auth, httpService.votePollAPI.bind(httpService));

  router.get(
    "/groups/:groupId/polls/:pollId/results",
    mdlFactory.auth,
    httpService.getPollResultsAPI.bind(httpService),
  );

  return {
    router,
    socketService,
  };
};

// ==================== Public Exports ====================
// Export models, DTOs, and interfaces for other modules that need to interact with Chat

// Models & DTOs
export * from "./model";

// Interfaces (Repository & UseCase interfaces)
export * from "./interface";

// Repositories (for modules that need direct data access)
export {
  MongoConversationRepository,
  MongoConversationMemberRepository,
  MongoMessageRepository,
  MongoMessageReactionQueryRepository,
  MongoMessageReactionCommandRepository,
  MongoPollQueryRepository,
  MongoPollCommandRepository,
  DynamoConversationRepository,
  DynamoConversationMemberRepository,
  DynamoMessageRepository,
  DynamoMessageReactionQueryRepository,
  DynamoMessageReactionCommandRepository,
  DynamoPollQueryRepository,
  DynamoPollCommandRepository,
  ConversationModel,
  ConversationMemberModel,
  MessageModel,
  MessageReactionModel,
  PollModel,
} from "./infras";
