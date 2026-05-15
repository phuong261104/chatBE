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
import { UserUseCase } from "@modules/user/usecase";
import { PresenceUseCase } from "@modules/user/usecase/presence-usecase";
import { RedisPresenceRepository } from "@modules/user/infras/repository/redis/presence-repo";
import { DynamoBlockRepository } from "@modules/blocks/infras/repository/dynamodb";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { ChatV2Controller } from "./infras/transport/http/v2-chat-controller";
import { setupChatV2Routes } from "./infras/transport/http/v2-chat.routes";

// ==================== Chat Module Components (using barrel exports) ====================
// Infrastructure: Repositories & Transport
import { UserRepositoryAdapter, MessagingHttpService, MessagingSocketService } from "./infras";

// ==================== DynamoDB Repositories ====================
import {
  DynamoConversationRepository,
  DynamoConversationMemberRepository,
  DynamoMessageRepository,
  DynamoMessageReactionQueryRepository,
  DynamoMessageReactionCommandRepository,
  DynamoPollQueryRepository,
  DynamoPollCommandRepository,
  DynamoPollRepository,
  DynamoMessageClassificationRepository,
} from "./infras/repository/dynamodb";

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
  GetConversationsCursorQueryHandler,
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
  DissolveGroupHandler,
  SearchMessagesHandler,
  GetConversationStatisticsQueryHandler,
  GetSharedConversationsQueryHandler,
  DeleteMessagesBulkHandler,
  GetConversationOnlineMembersQueryHandler,
  GetDraftsQueryHandler,
  TranslateMessageHandler,
  CopyConversationHandler,
  ChatAccessPolicy,
} from "./usecase";

export const setupMessagingHexagon = (io: SocketIOServer, sctx: ServiceContext) => {
  const mdlFactory = sctx.mdlFactory;

  const conversationRepo = new DynamoConversationRepository();
  const conversationMemberRepo = new DynamoConversationMemberRepository();
  const messageRepo = new DynamoMessageRepository();
  const reactionQueryRepo = new DynamoMessageReactionQueryRepository();
  const reactionCmdRepo = new DynamoMessageReactionCommandRepository();
  const pollQueryRepo = new DynamoPollQueryRepository();
  const pollCmdRepo = new DynamoPollCommandRepository();
  const pollRepo = new DynamoPollRepository(pollQueryRepo, pollCmdRepo);
  const blockRepo = new DynamoBlockRepository();
  const friendshipRepo = new DynamoFriendshipRepository();
  const presenceUseCase = new PresenceUseCase(new RedisPresenceRepository());

  const classificationRepo = new DynamoMessageClassificationRepository();

  const userRepo = new DynamoUserRepository();
  const userUseCase = new UserUseCase(userRepo);
  const userAdapter = new UserRepositoryAdapter(userUseCase);
  const accessPolicy = new ChatAccessPolicy(
    userAdapter,
    blockRepo,
    conversationRepo,
    conversationMemberRepo,
  );

  const getOrCreatePrivateConversationHandler = new GetOrCreatePrivateConversationHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    accessPolicy,
    conversationMemberRepo,
  );

  const sendMessageHandler = new SendMessageHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    conversationRepo,
    conversationRepo,
    classificationRepo,
    accessPolicy,
  );

  const createGroupHandler = new CreateGroupHandler(
    conversationRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
    accessPolicy,
  );

  const sendGroupMessageHandler = new SendGroupMessageHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    conversationRepo,
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
    accessPolicy,
  );

  const removeMemberFromGroupHandler = new RemoveMemberFromGroupHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
  );

  const updateGroupInfoHandler = new UpdateGroupInfoHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
  );

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
    messageRepo,
  );

  const getConversationDetailQueryHandler = new GetConversationDetailQueryHandler(
    conversationRepo,
    conversationMemberRepo,
  );

  const getConversationMembersQueryHandler = new GetConversationMembersQueryHandler(conversationMemberRepo);

  const loadMessagesQueryHandler = new LoadMessagesQueryHandler(
    conversationMemberRepo,
    messageRepo,
    reactionQueryRepo,
    userAdapter,
  );

  const getTotalUnreadCountQueryHandler = new GetTotalUnreadCountQueryHandler(conversationMemberRepo);

  const getGroupMembersQueryHandler = new GetGroupMembersQueryHandler(conversationRepo, conversationMemberRepo);

  const revokeMessageHandler = new RevokeMessageHandler(
    messageRepo,
    messageRepo,
    conversationMemberRepo,
    classificationRepo,
    conversationRepo,
    conversationRepo,
  );

  const deleteMessageForMeHandler = new DeleteMessageForMeHandler(messageRepo, messageRepo, conversationMemberRepo);

  const deleteMessageForEveryoneHandler = new DeleteMessageForEveryoneHandler(
    messageRepo,
    messageRepo,
    conversationMemberRepo,
    classificationRepo,
    conversationRepo,
    conversationRepo,
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

  const pinMessageHandler = new PinMessageHandler(
    messageRepo,
    messageRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    conversationRepo,
    conversationRepo,
    userAdapter,
  );

  const unpinMessageHandler = new UnpinMessageHandler(
    messageRepo,
    messageRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    conversationRepo,
    conversationRepo,
    userAdapter,
  );

  const getPinnedMessagesHandler = new GetPinnedMessagesHandler(messageRepo, conversationMemberRepo);

  const addReactionHandler = new AddReactionHandler(
    messageRepo,
    reactionQueryRepo,
    reactionCmdRepo as any,
    conversationMemberRepo as any,
    userAdapter,
  );

  const removeReactionHandler = new RemoveReactionHandler(messageRepo, reactionCmdRepo as any, conversationMemberRepo);

  const removeAllReactionsHandler = new RemoveAllReactionsHandler(messageRepo, reactionCmdRepo as any, conversationMemberRepo);

  const getReactionsHandler = new GetReactionsHandler(messageRepo, reactionQueryRepo, conversationMemberRepo, userAdapter);

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
    messageRepo,
    userAdapter,
  );

  const transferOwnerHandler = new TransferOwnerHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
  );

  const createPollHandler = new CreatePollHandler(conversationRepo, conversationMemberRepo, pollCmdRepo);

  const getPollsHandler = new GetPollsHandler(pollQueryRepo as any, conversationRepo, conversationMemberRepo);

  const votePollHandler = new VotePollHandler(pollQueryRepo, pollCmdRepo, conversationMemberRepo);

  const getPollResultsHandler = new GetPollResultsHandler(pollQueryRepo, conversationMemberRepo);

  const getPendingMembersHandler = new GetPendingMembersHandler(conversationRepo, conversationMemberRepo);

  const approveMemberHandler = new ApproveMemberHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
  );

  const rejectMemberHandler = new RejectMemberHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    userAdapter,
  );

  const updateGroupSettingsHandler = new UpdateGroupSettingsHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
  );

  const getGroupInfoHandler = new GetGroupInfoHandler(conversationRepo, conversationMemberRepo);

  const getConversationMediaQueryHandler = new GetConversationMediaQueryHandler(
    conversationMemberRepo,
    classificationRepo,
    messageRepo,
  );

  const getConversationsCursorQueryHandler = new GetConversationsCursorQueryHandler(
    conversationRepo,
    conversationMemberRepo as any,
    userAdapter,
    messageRepo,
  );

  const dissolveGroupHandler = new DissolveGroupHandler(
    conversationRepo as any,
    conversationRepo as any,
    conversationMemberRepo as any,
    conversationMemberRepo as any,
    messageRepo,
    reactionCmdRepo as any,
    classificationRepo,
    pollRepo as any,
  );

  const searchMessagesHandler = new SearchMessagesHandler(conversationMemberRepo, messageRepo);

  const getConversationStatisticsQueryHandler = new GetConversationStatisticsQueryHandler(
    conversationRepo,
    conversationMemberRepo,
    messageRepo,
  );

  const getSharedConversationsQueryHandler = new GetSharedConversationsQueryHandler(
    conversationRepo,
    conversationMemberRepo,
  );

  const deleteMessagesBulkHandler = new DeleteMessagesBulkHandler(
    conversationMemberRepo,
    messageRepo,
    messageRepo,
  );

  const getConversationOnlineMembersQueryHandler = new GetConversationOnlineMembersQueryHandler(
    conversationMemberRepo,
    presenceUseCase,
  );

  const getDraftsQueryHandler = new GetDraftsQueryHandler(conversationMemberRepo);

  const translateMessageHandler = new TranslateMessageHandler(messageRepo);

  const copyConversationHandler = new CopyConversationHandler(
    conversationMemberRepo,
    conversationMemberRepo,
    messageRepo,
    messageRepo,
    conversationRepo,
    conversationRepo,
    accessPolicy,
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
    getConversationsCursorQueryHandler,
    dissolveGroupHandler,
    searchMessagesHandler,
    getConversationStatisticsQueryHandler,
    getSharedConversationsQueryHandler,
    deleteMessagesBulkHandler,
    getConversationOnlineMembersQueryHandler,
    getDraftsQueryHandler,
    translateMessageHandler,
    copyConversationHandler,
  );

  const httpService = new MessagingHttpService(useCase);
  const socketService = new MessagingSocketService(io, useCase, presenceUseCase);
  const v2Controller = new ChatV2Controller(
    useCase,
    conversationRepo,
    conversationMemberRepo,
    messageRepo,
    friendshipRepo,
    blockRepo,
    userAdapter,
    socketService,
    presenceUseCase,
  );

  httpService.setSocketService(socketService);

  const router = Router();
  const v2Router = setupChatV2Routes(v2Controller, mdlFactory);

  router.post("/conversations/private", mdlFactory.auth, httpService.getPrivateConversationAPI.bind(httpService));
  router.get("/conversations/unread-count", mdlFactory.auth, httpService.getTotalUnreadCountAPI.bind(httpService));
  router.get("/conversations", mdlFactory.auth, httpService.getConversationsAPI.bind(httpService));
  router.get("/conversations/cursor", mdlFactory.auth, httpService.getConversationsCursorAPI.bind(httpService));
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

  router.get("/conversations/:conversationId/search", mdlFactory.auth, httpService.searchMessagesAPI.bind(httpService));

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

  router.delete("/groups/:groupId", mdlFactory.auth, httpService.dissolveGroupAPI.bind(httpService));

  router.post("/groups/:groupId/polls", mdlFactory.auth, httpService.createPollAPI.bind(httpService));

  router.get("/groups/:groupId/polls", mdlFactory.auth, httpService.getPollsAPI.bind(httpService));

  router.post("/groups/:groupId/polls/:pollId/vote", mdlFactory.auth, httpService.votePollAPI.bind(httpService));

  router.get(
    "/groups/:groupId/polls/:pollId/results",
    mdlFactory.auth,
    httpService.getPollResultsAPI.bind(httpService),
  );

  router.get("/conversations/:conversationId/statistics", mdlFactory.auth, httpService.getConversationStatisticsAPI.bind(httpService));

  router.get("/users/:userId/conversations", mdlFactory.auth, httpService.getSharedConversationsAPI.bind(httpService));

  router.delete("/conversations/:conversationId/messages/bulk", mdlFactory.auth, httpService.deleteMessagesBulkAPI.bind(httpService));

  router.get("/conversations/:conversationId/members/online", mdlFactory.auth, httpService.getConversationOnlineMembersAPI.bind(httpService));

  router.get("/conversations/:conversationId/drafts", mdlFactory.auth, httpService.getDraftsAPI.bind(httpService));

  router.post("/messages/:messageId/translate", mdlFactory.auth, httpService.translateMessageAPI.bind(httpService));

  router.post("/conversations/:conversationId/copy", mdlFactory.auth, httpService.copyConversationAPI.bind(httpService));

  return {
    router,
    v2Router,
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
  DynamoConversationRepository,
  DynamoConversationMemberRepository,
  DynamoMessageRepository,
  DynamoMessageReactionQueryRepository,
  DynamoMessageReactionCommandRepository,
  DynamoPollQueryRepository,
  DynamoPollCommandRepository,
  MessagingSocketService,
} from "./infras";
