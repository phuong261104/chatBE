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
import { UserRepositoryAdapter, MessagingHttpService, MessagingSocketService, MessagingHttpServiceDeps } from "./infras";
import { GroupInviteController } from "./infras/transport/http/group-invite-controller";
import { GroupBlockController } from "./infras/transport/http/group-block-controller";

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
  DynamoGroupReminderRepository,
  DynamoGroupNoteRepository,
  DynamoMessageClassificationRepository,
  DynamoGroupInviteLinkRepository,
  DynamoGroupBlockRepository,
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
  SaveMessagesToMyDocumentHandler,
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
  AddPollOptionHandler,
  GetPollsHandler,
  VotePollHandler,
  GetPollResultsHandler,
  ClosePollHandler,
  PinPollHandler,
  UnpinPollHandler,
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
  CreateGroupReminderHandler,
  ListGroupRemindersHandler,
  UpdateGroupReminderHandler,
  DeleteGroupReminderHandler,
  PinGroupReminderHandler,
  UnpinGroupReminderHandler,
  CreateGroupNoteHandler,
  ListGroupNotesHandler,
  UpdateGroupNoteHandler,
  DeleteGroupNoteHandler,
  ChatAccessPolicy,
  GetGroupInviteLinkHandler,
  RegenerateGroupInviteLinkHandler,
  RevokeGroupInviteLinkHandler,
  PreviewInviteHandler,
  JoinGroupByInviteHandler,
  GetGroupBlocksHandler,
  BlockGroupMemberHandler,
  UnblockGroupMemberHandler,
} from "./usecase";
import { GroupUtilityWorker } from "./usecase/group-utility-worker";

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
  const groupReminderRepo = new DynamoGroupReminderRepository();
  const groupNoteRepo = new DynamoGroupNoteRepository();
  const blockRepo = new DynamoBlockRepository();
  const friendshipRepo = new DynamoFriendshipRepository();
  const presenceUseCase = new PresenceUseCase(new RedisPresenceRepository());

  const classificationRepo = new DynamoMessageClassificationRepository();
  const groupInviteLinkRepo = new DynamoGroupInviteLinkRepository();
  const groupBlockRepo = new DynamoGroupBlockRepository();

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
    groupBlockRepo,
    groupBlockRepo,
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
    conversationRepo,
    conversationMemberRepo,
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
    pollQueryRepo,
    groupReminderRepo,
    conversationRepo,
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

  const saveMessagesToMyDocumentHandler = new SaveMessagesToMyDocumentHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    forwardMessagesHandler,
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

  const getPinnedMessagesHandler = new GetPinnedMessagesHandler(
    messageRepo,
    conversationMemberRepo,
    pollQueryRepo,
    groupReminderRepo,
    conversationRepo,
  );

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

  const createPollHandler = new CreatePollHandler(
    conversationRepo,
    conversationMemberRepo,
    pollCmdRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );

  const getPollsHandler = new GetPollsHandler(pollQueryRepo as any, conversationRepo, conversationMemberRepo);

  const votePollHandler = new VotePollHandler(
    pollQueryRepo,
    pollCmdRepo,
    conversationMemberRepo,
    messageRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );

  const addPollOptionHandler = new AddPollOptionHandler(pollQueryRepo, pollCmdRepo, conversationMemberRepo);

  const getPollResultsHandler = new GetPollResultsHandler(pollQueryRepo, conversationMemberRepo, conversationRepo);

  const closePollHandler = new ClosePollHandler(
    pollQueryRepo,
    pollCmdRepo,
    conversationMemberRepo,
    conversationRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );

  const pinPollHandler = new PinPollHandler(
    pollQueryRepo,
    pollCmdRepo,
    conversationMemberRepo,
    conversationRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );

  const unpinPollHandler = new UnpinPollHandler(
    pollQueryRepo,
    pollCmdRepo,
    conversationMemberRepo,
    conversationRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );

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
    conversationRepo,
    conversationMemberRepo,
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

  const createGroupReminderHandler = new CreateGroupReminderHandler(
    conversationRepo,
    conversationMemberRepo,
    groupReminderRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );
  const listGroupRemindersHandler = new ListGroupRemindersHandler(conversationRepo, conversationMemberRepo, groupReminderRepo);
  const updateGroupReminderHandler = new UpdateGroupReminderHandler(
    conversationRepo,
    conversationMemberRepo,
    groupReminderRepo,
    groupReminderRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );
  const deleteGroupReminderHandler = new DeleteGroupReminderHandler(
    conversationRepo,
    conversationMemberRepo,
    groupReminderRepo,
    groupReminderRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );
  const pinGroupReminderHandler = new PinGroupReminderHandler(
    conversationRepo,
    conversationMemberRepo,
    groupReminderRepo,
    groupReminderRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );
  const unpinGroupReminderHandler = new UnpinGroupReminderHandler(
    conversationRepo,
    conversationMemberRepo,
    groupReminderRepo,
    groupReminderRepo,
    messageRepo,
    conversationRepo,
    conversationMemberRepo,
  );
  const createGroupNoteHandler = new CreateGroupNoteHandler(conversationRepo, conversationMemberRepo, groupNoteRepo);
  const listGroupNotesHandler = new ListGroupNotesHandler(conversationRepo, conversationMemberRepo, groupNoteRepo);
  const updateGroupNoteHandler = new UpdateGroupNoteHandler(conversationRepo, conversationMemberRepo, groupNoteRepo, groupNoteRepo);
  const deleteGroupNoteHandler = new DeleteGroupNoteHandler(conversationRepo, conversationMemberRepo, groupNoteRepo, groupNoteRepo);

  const getGroupInviteLinkHandler = new GetGroupInviteLinkHandler(
    conversationRepo,
    groupInviteLinkRepo,
    groupInviteLinkRepo,
    conversationMemberRepo,
  );
  const regenerateGroupInviteLinkHandler = new RegenerateGroupInviteLinkHandler(
    conversationRepo,
    groupInviteLinkRepo,
    groupInviteLinkRepo,
    conversationMemberRepo,
  );
  const revokeGroupInviteLinkHandler = new RevokeGroupInviteLinkHandler(
    conversationRepo,
    groupInviteLinkRepo,
    groupInviteLinkRepo,
    conversationMemberRepo,
  );
  const previewInviteHandler = new PreviewInviteHandler(
    groupInviteLinkRepo,
    conversationRepo,
    userAdapter,
  );
  const joinGroupByInviteHandler = new JoinGroupByInviteHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    groupInviteLinkRepo,
    groupInviteLinkRepo,
    groupBlockRepo,
    messageRepo,
    userAdapter,
  );
  const getGroupBlocksHandler = new GetGroupBlocksHandler(
    conversationRepo,
    groupBlockRepo,
    conversationMemberRepo,
    userAdapter,
  );
  const blockGroupMemberHandler = new BlockGroupMemberHandler(
    conversationRepo,
    conversationRepo,
    conversationMemberRepo,
    conversationMemberRepo,
    groupBlockRepo,
    groupBlockRepo,
    messageRepo,
    userAdapter,
  );
  const unblockGroupMemberHandler = new UnblockGroupMemberHandler(
    conversationRepo,
    groupBlockRepo,
    groupBlockRepo,
    conversationMemberRepo,
    userAdapter,
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
    saveMessagesToMyDocumentHandler,
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
    addPollOptionHandler,
    getPollResultsHandler,
    closePollHandler,
    pinPollHandler,
    unpinPollHandler,
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
    createGroupReminderHandler,
    listGroupRemindersHandler,
    updateGroupReminderHandler,
    deleteGroupReminderHandler,
    pinGroupReminderHandler,
    unpinGroupReminderHandler,
    createGroupNoteHandler,
    listGroupNotesHandler,
    updateGroupNoteHandler,
    deleteGroupNoteHandler,
  );

  const httpService = new MessagingHttpService(useCase, {
    groupInviteController: new GroupInviteController(
      getGroupInviteLinkHandler,
      regenerateGroupInviteLinkHandler,
      revokeGroupInviteLinkHandler,
      previewInviteHandler,
      joinGroupByInviteHandler,
    ),
    groupBlockController: new GroupBlockController(
      getGroupBlocksHandler,
      blockGroupMemberHandler,
      unblockGroupMemberHandler,
    ),
  });
  const socketService = new MessagingSocketService(io, useCase, presenceUseCase);
  socketService.getGroupInviteLinkHandler = getGroupInviteLinkHandler;
  socketService.regenerateGroupInviteLinkHandler = regenerateGroupInviteLinkHandler;
  socketService.revokeGroupInviteLinkHandler = revokeGroupInviteLinkHandler;
  socketService.previewInviteHandler = previewInviteHandler;
  socketService.joinGroupByInviteHandler = joinGroupByInviteHandler;
  socketService.getGroupBlocksHandler = getGroupBlocksHandler;
  socketService.blockGroupMemberHandler = blockGroupMemberHandler;
  socketService.unblockGroupMemberHandler = unblockGroupMemberHandler;
  if (process.env.CHAT_UTILITY_WORKER_ENABLED !== "false") {
    new GroupUtilityWorker({
      pollQueryRepo,
      pollCommandRepo: pollCmdRepo,
      reminderQueryRepo: groupReminderRepo,
      reminderCommandRepo: groupReminderRepo,
      messageCommandRepo: messageRepo,
      conversationCommandRepo: conversationRepo,
      conversationMemberCommandRepo: conversationMemberRepo,
      notifier: socketService,
    }).start();
  }
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
  router.get("/conversations/:conversationId", mdlFactory.auth, httpService.getConversationDetailAPI.bind(httpService));
  router.get("/conversations/:conversationId/messages", mdlFactory.auth, httpService.loadMessagesAPI.bind(httpService));

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

  router.delete("/groups/:groupId/members/:userId", mdlFactory.auth, httpService.removeMemberAPI.bind(httpService));
  router.put("/groups/:groupId", mdlFactory.auth, httpService.updateGroupAPI.bind(httpService));
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

  router.get("/groups/:groupId/info", mdlFactory.auth, httpService.getGroupInfoAPI.bind(httpService));

  router.delete("/groups/:groupId", mdlFactory.auth, httpService.dissolveGroupAPI.bind(httpService));

  router.post("/groups/:groupId/polls", mdlFactory.auth, httpService.createPollAPI.bind(httpService));

  router.get("/groups/:groupId/polls", mdlFactory.auth, httpService.getPollsAPI.bind(httpService));

  router.post("/groups/:groupId/polls/:pollId/vote", mdlFactory.auth, httpService.votePollAPI.bind(httpService));

  router.post("/groups/:groupId/polls/:pollId/options", mdlFactory.auth, httpService.addPollOptionAPI.bind(httpService));

  router.post("/groups/:groupId/polls/:pollId/lock", mdlFactory.auth, httpService.closePollAPI.bind(httpService));

  router.post("/groups/:groupId/polls/:pollId/pin", mdlFactory.auth, httpService.pinPollAPI.bind(httpService));

  router.delete("/groups/:groupId/polls/:pollId/pin", mdlFactory.auth, httpService.unpinPollAPI.bind(httpService));

  router.get(
    "/groups/:groupId/polls/:pollId/results",
    mdlFactory.auth,
    httpService.getPollResultsAPI.bind(httpService),
  );

  router.get("/groups/:groupId/reminders", mdlFactory.auth, httpService.listGroupRemindersAPI.bind(httpService));
  router.post("/groups/:groupId/reminders", mdlFactory.auth, httpService.createGroupReminderAPI.bind(httpService));
  router.put("/groups/:groupId/reminders/:reminderId", mdlFactory.auth, httpService.updateGroupReminderAPI.bind(httpService));
  router.delete("/groups/:groupId/reminders/:reminderId", mdlFactory.auth, httpService.deleteGroupReminderAPI.bind(httpService));
  router.post("/groups/:groupId/reminders/:reminderId/pin", mdlFactory.auth, httpService.pinGroupReminderAPI.bind(httpService));
  router.delete("/groups/:groupId/reminders/:reminderId/pin", mdlFactory.auth, httpService.unpinGroupReminderAPI.bind(httpService));

  router.get("/groups/:groupId/notes", mdlFactory.auth, httpService.listGroupNotesAPI.bind(httpService));
  router.post("/groups/:groupId/notes", mdlFactory.auth, httpService.createGroupNoteAPI.bind(httpService));
  router.put("/groups/:groupId/notes/:noteId", mdlFactory.auth, httpService.updateGroupNoteAPI.bind(httpService));
  router.delete("/groups/:groupId/notes/:noteId", mdlFactory.auth, httpService.deleteGroupNoteAPI.bind(httpService));

  router.get("/conversations/:conversationId/statistics", mdlFactory.auth, httpService.getConversationStatisticsAPI.bind(httpService));

  router.get("/users/:userId/conversations", mdlFactory.auth, httpService.getSharedConversationsAPI.bind(httpService));

  router.delete("/conversations/:conversationId/messages/bulk", mdlFactory.auth, httpService.deleteMessagesBulkAPI.bind(httpService));

  router.get("/conversations/:conversationId/members/online", mdlFactory.auth, httpService.getConversationOnlineMembersAPI.bind(httpService));

  router.get("/conversations/:conversationId/drafts", mdlFactory.auth, httpService.getDraftsAPI.bind(httpService));

  router.post("/messages/:messageId/translate", mdlFactory.auth, httpService.translateMessageAPI.bind(httpService));

  router.post("/conversations/:conversationId/copy", mdlFactory.auth, httpService.copyConversationAPI.bind(httpService));

  router.get("/groups/:groupId/invite-link", mdlFactory.auth, httpService.getGroupInviteLinkAPI.bind(httpService));
  router.post("/groups/:groupId/invite-link/regenerate", mdlFactory.auth, httpService.regenerateGroupInviteLinkAPI.bind(httpService));
  router.delete("/groups/:groupId/invite-link", mdlFactory.auth, httpService.revokeGroupInviteLinkAPI.bind(httpService));
  router.get("/invites/:token/preview", httpService.previewInviteAPI.bind(httpService));
  router.post("/invites/:token/join", mdlFactory.auth, httpService.joinGroupByInviteAPI.bind(httpService));

  router.get("/groups/:groupId/blocks", mdlFactory.auth, httpService.getGroupBlocksAPI.bind(httpService));
  router.post("/groups/:groupId/blocks", mdlFactory.auth, httpService.blockGroupMemberAPI.bind(httpService));
  router.delete("/groups/:groupId/blocks/:userId", mdlFactory.auth, httpService.unblockGroupMemberAPI.bind(httpService));

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
  DynamoGroupInviteLinkRepository,
  DynamoGroupBlockRepository,
} from "./infras";
