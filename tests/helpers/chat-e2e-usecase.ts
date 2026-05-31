import {
  AddMembersToGroupHandler,
  AddPollOptionHandler,
  AddReactionHandler,
  ApproveMemberHandler,
  ClosePollHandler,
  CreateGroupHandler,
  CreateGroupNoteHandler,
  CreateGroupReminderHandler,
  CreatePollHandler,
  DeleteGroupNoteHandler,
  DeleteGroupReminderHandler,
  DeleteConversationForMeHandler,
  DeleteMessageForEveryoneHandler,
  DeleteMessageForMeHandler,
  EditMessageHandler,
  ForwardMessagesHandler,
  GetConversationsCursorQueryHandler,
  GetConversationsQueryHandler,
  GetConversationDetailQueryHandler,
  GetConversationMediaQueryHandler,
  GetConversationMembersQueryHandler,
  GetPendingMembersHandler,
  GetPinnedMessagesHandler,
  GetPollResultsHandler,
  GetPollsHandler,
  GetPollHandler,
  GetReactionsHandler,
  LeaveGroupHandler,
  ListGroupNotesHandler,
  ListGroupRemindersHandler,
  LoadMessagesQueryHandler,
  MarkAsDeliveredHandler,
  MarkAsSeenHandler,
  PinMessageHandler,
  PinConversationHandler,
  PinGroupReminderHandler,
  PinPollHandler,
  QuoteMessageHandler,
  RejectMemberHandler,
  RemoveAllReactionsHandler,
  RemoveReactionHandler,
  RevokeMessageHandler,
  SendGroupMessageHandler,
  SendMessageHandler,
  SetAdminHandler,
  SearchMessagesHandler,
  SaveMessagesToMyDocumentHandler,
  TransferOwnerHandler,
  UnpinMessageHandler,
  UnpinConversationHandler,
  UnpinGroupReminderHandler,
  UnpinPollHandler,
  DeletePollHandler,
  UpdateGroupInfoHandler,
  UpdateGroupNoteHandler,
  UpdateGroupReminderHandler,
  UpdateGroupSettingsHandler,
  VotePollHandler,
} from "@modules/chat/usecase";
import { ChatAccessPolicy } from "@modules/chat/usecase/chat-access-policy";
import { ChatE2EStore } from "./chat-e2e-store";
import {
  InMemoryBlockRepository,
  InMemoryClassificationRepository,
  InMemoryConversationMemberRepository,
  InMemoryConversationRepository,
  InMemoryFriendshipRepository,
  InMemoryGroupBlockCommandRepository,
  InMemoryGroupBlockQueryRepository,
  InMemoryGroupInviteLinkCommandRepository,
  InMemoryGroupInviteLinkQueryRepository,
  InMemoryGroupNoteRepository,
  InMemoryGroupReminderRepository,
  InMemoryMessageRepository,
  InMemoryPollRepository,
  InMemoryReactionRepository,
  InMemoryUserRepository,
} from "./chat-e2e-repositories";

export class TestPresenceUseCase {
  async registerSocket(): Promise<{ becameOnline: boolean }> {
    return { becameOnline: false };
  }

  async unregisterSocket(): Promise<{ becameOffline: boolean }> {
    return { becameOffline: false };
  }

  async touchSocket(): Promise<void> {}

  async getUserPresence(): Promise<{ isOnline: boolean; lastSeen: Date | null }> {
    return { isOnline: false, lastSeen: null };
  }
}

export function buildUseCase(store: ChatE2EStore) {
  const userRepo = new InMemoryUserRepository(store);
  const conversationRepo = new InMemoryConversationRepository(store);
  const memberRepo = new InMemoryConversationMemberRepository(store);
  const messageRepo = new InMemoryMessageRepository(store);
  const reactionRepo = new InMemoryReactionRepository(store);
  const pollRepo = new InMemoryPollRepository(store);
  const reminderRepo = new InMemoryGroupReminderRepository(store);
  const noteRepo = new InMemoryGroupNoteRepository(store);
  const classificationRepo = new InMemoryClassificationRepository(store);
  const friendshipRepo = new InMemoryFriendshipRepository(store);
  const blockRepo = new InMemoryBlockRepository(store);
  const groupInviteLinkQueryRepo = new InMemoryGroupInviteLinkQueryRepository(store);
  const groupInviteLinkCommandRepo = new InMemoryGroupInviteLinkCommandRepository(store);
  const groupBlockQueryRepo = new InMemoryGroupBlockQueryRepository(store);
  const groupBlockCommandRepo = new InMemoryGroupBlockCommandRepository(store);
  const accessPolicy = new ChatAccessPolicy(userRepo as any, blockRepo as any, conversationRepo as any, memberRepo as any);

  const getConversationDetail = new GetConversationDetailQueryHandler(conversationRepo as any, memberRepo as any);
  const getConversations = new GetConversationsQueryHandler(
    conversationRepo as any,
    memberRepo as any,
    userRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const getConversationsCursor = new GetConversationsCursorQueryHandler(
    conversationRepo as any,
    memberRepo as any,
    userRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const getConversationMembers = new GetConversationMembersQueryHandler(memberRepo as any);
  const createGroup = new CreateGroupHandler(
    conversationRepo as any,
    memberRepo as any,
    messageRepo as any,
    userRepo as any,
    accessPolicy as any,
  );
  const addMembersToGroup = new AddMembersToGroupHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    userRepo as any,
    accessPolicy as any,
  );
  const leaveGroup = new LeaveGroupHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    userRepo as any,
  );
  const updateGroupInfo = new UpdateGroupInfoHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    userRepo as any,
  );
  const updateGroupSettings = new UpdateGroupSettingsHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const setAdmin = new SetAdminHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    userRepo as any,
  );
  const transferOwner = new TransferOwnerHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    userRepo as any,
  );
  const getPendingMembers = new GetPendingMembersHandler(conversationRepo as any, memberRepo as any);
  const approveMember = new ApproveMemberHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    userRepo as any,
  );
  const rejectMember = new RejectMemberHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    userRepo as any,
  );
  const sendMessage = new SendMessageHandler(
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    messageRepo as any,
    conversationRepo as any,
    conversationRepo as any,
    classificationRepo as any,
    accessPolicy as any,
  );
  const sendGroupMessage = new SendGroupMessageHandler(
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    messageRepo as any,
    conversationRepo as any,
    conversationRepo as any,
    classificationRepo as any,
  );
  const loadMessages = new LoadMessagesQueryHandler(
    memberRepo as any,
    messageRepo as any,
    reactionRepo as any,
    userRepo as any,
    pollRepo as any,
    reminderRepo as any,
    conversationRepo as any,
  );
  const markAsSeen = new MarkAsSeenHandler(memberRepo as any, memberRepo as any, messageRepo as any);
  const markAsDelivered = new MarkAsDeliveredHandler(memberRepo as any, memberRepo as any, messageRepo as any);
  const revokeMessage = new RevokeMessageHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    classificationRepo as any,
    conversationRepo as any,
    conversationRepo as any,
  );
  const deleteMessageForMe = new DeleteMessageForMeHandler(messageRepo as any, messageRepo as any, memberRepo as any);
  const deleteMessageForEveryone = new DeleteMessageForEveryoneHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    classificationRepo as any,
    conversationRepo as any,
    conversationRepo as any,
  );
  const editMessage = new EditMessageHandler(messageRepo as any, messageRepo as any, memberRepo as any);
  const forwardMessages = new ForwardMessagesHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    messageRepo as any,
    classificationRepo as any,
  );
  const saveMessagesToMyDocument = new SaveMessagesToMyDocumentHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    forwardMessages,
  );
  const pinConversation = new PinConversationHandler(memberRepo as any, memberRepo as any);
  const unpinConversation = new UnpinConversationHandler(memberRepo as any, memberRepo as any);
  const deleteConversationForMe = new DeleteConversationForMeHandler(memberRepo as any, memberRepo as any);
  const pinMessage = new PinMessageHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    memberRepo as any,
    conversationRepo as any,
    conversationRepo as any,
    userRepo as any,
  );
  const unpinMessage = new UnpinMessageHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    memberRepo as any,
    conversationRepo as any,
    conversationRepo as any,
    userRepo as any,
  );
  const getPinnedMessages = new GetPinnedMessagesHandler(
    messageRepo as any,
    memberRepo as any,
    pollRepo as any,
    reminderRepo as any,
    conversationRepo as any,
  );
  const getConversationMedia = new GetConversationMediaQueryHandler(
    memberRepo as any,
    classificationRepo as any,
    messageRepo as any,
  );
  const searchMessages = new SearchMessagesHandler(memberRepo as any, messageRepo as any);
  const addReaction = new AddReactionHandler(
    messageRepo as any,
    reactionRepo as any,
    reactionRepo as any,
    memberRepo as any,
    userRepo as any,
  );
  const removeReaction = new RemoveReactionHandler(messageRepo as any, reactionRepo as any, memberRepo as any);
  const removeAllReactions = new RemoveAllReactionsHandler(messageRepo as any, reactionRepo as any, memberRepo as any);
  const getReactions = new GetReactionsHandler(
    messageRepo as any,
    reactionRepo as any,
    memberRepo as any,
    userRepo as any,
  );
  const quoteMessage = new QuoteMessageHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    conversationRepo as any,
    classificationRepo as any,
  );
  const createPoll = new CreatePollHandler(
    conversationRepo as any,
    memberRepo as any,
    pollRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const getPolls = new GetPollsHandler(pollRepo as any, conversationRepo as any, memberRepo as any);
  const getPoll = new GetPollHandler(pollRepo as any, memberRepo as any, conversationRepo as any);
  const votePoll = new VotePollHandler(
    pollRepo as any,
    pollRepo as any,
    memberRepo as any,
    messageRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const addPollOption = new AddPollOptionHandler(pollRepo as any, pollRepo as any, memberRepo as any, memberRepo as any, conversationRepo as any, messageRepo as any);
  const getPollResults = new GetPollResultsHandler(pollRepo as any, memberRepo as any, conversationRepo as any);
  const closePoll = new ClosePollHandler(
    pollRepo as any,
    pollRepo as any,
    memberRepo as any,
    conversationRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const pinPoll = new PinPollHandler(
    pollRepo as any,
    pollRepo as any,
    memberRepo as any,
    conversationRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const unpinPoll = new UnpinPollHandler(
    pollRepo as any,
    pollRepo as any,
    memberRepo as any,
    conversationRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const deletePoll = new DeletePollHandler(
    pollRepo as any,
    pollRepo as any,
    memberRepo as any,
    conversationRepo as any,
    messageRepo as any,
  );
  const createGroupReminder = new CreateGroupReminderHandler(
    conversationRepo as any,
    memberRepo as any,
    reminderRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const listGroupReminders = new ListGroupRemindersHandler(conversationRepo as any, memberRepo as any, reminderRepo as any);
  const updateGroupReminder = new UpdateGroupReminderHandler(
    conversationRepo as any,
    memberRepo as any,
    reminderRepo as any,
    reminderRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const deleteGroupReminder = new DeleteGroupReminderHandler(
    conversationRepo as any,
    memberRepo as any,
    reminderRepo as any,
    reminderRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const pinGroupReminder = new PinGroupReminderHandler(
    conversationRepo as any,
    memberRepo as any,
    reminderRepo as any,
    reminderRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const unpinGroupReminder = new UnpinGroupReminderHandler(
    conversationRepo as any,
    memberRepo as any,
    reminderRepo as any,
    reminderRepo as any,
    messageRepo as any,
    conversationRepo as any,
    memberRepo as any,
  );
  const createGroupNote = new CreateGroupNoteHandler(conversationRepo as any, memberRepo as any, noteRepo as any);
  const listGroupNotes = new ListGroupNotesHandler(conversationRepo as any, memberRepo as any, noteRepo as any);
  const updateGroupNote = new UpdateGroupNoteHandler(
    conversationRepo as any,
    memberRepo as any,
    noteRepo as any,
    noteRepo as any,
  );
  const deleteGroupNote = new DeleteGroupNoteHandler(
    conversationRepo as any,
    memberRepo as any,
    noteRepo as any,
    noteRepo as any,
  );

  return {
    repos: {
      userRepo,
      conversationRepo,
      memberRepo,
      messageRepo,
      reactionRepo,
      classificationRepo,
      pollRepo,
      reminderRepo,
      noteRepo,
      friendshipRepo,
      blockRepo,
      groupInviteLinkRepo: { query: groupInviteLinkQueryRepo, command: groupInviteLinkCommandRepo },
      groupBlockRepo: { query: groupBlockQueryRepo, command: groupBlockCommandRepo },
    },
    useCase: {
      getConversations: (userId: string, page?: number, limit?: number) =>
        getConversations.query({ userId, page, limit }),
      getConversationsCursor: (userId: string, cursor?: string, limit?: number) =>
        getConversationsCursor.query({ userId, cursor, limit }),
      getConversationDetail: (conversationId: string, userId: string) =>
        getConversationDetail.query({ conversationId, userId }),
      getConversationMembers: (conversationId: string, excludeUserId?: string) =>
        getConversationMembers.query({ conversationId, excludeUserId }),
      createGroup: (creatorId: string, data: { name: string; memberIds: string[]; avatarUrl?: string }) =>
        createGroup.execute({ creatorId, data }),
      addMembersToGroup: (conversationId: string, requesterId: string, memberIds: string[]) =>
        addMembersToGroup.execute({ conversationId, requesterId, memberIds }),
      leaveGroup: (conversationId: string, userId: string, autoTransferOwner?: boolean) =>
        leaveGroup.execute({ conversationId, userId, autoTransferOwner }),
      updateGroupInfo: (conversationId: string, requesterId: string, data: { name?: string; avatarUrl?: string }) =>
        updateGroupInfo.execute({ conversationId, requesterId, ...data }),
      updateGroupSettings: (
        groupId: string,
        requesterId: string,
        settings: {
          allowSendLink?: boolean;
          requireApproval?: boolean;
          allowMemberInvite?: boolean;
          whoCanSendMessages?: "all" | "admins";
          whoCanAddMembers?: "all" | "admins";
          utilityPermissions?: {
            poll?: "all" | "admins";
            reminder?: "all" | "admins";
            note?: "all" | "admins";
          };
        },
      ) => updateGroupSettings.execute({ groupId, requesterId, ...settings }),
      setAdmin: (groupId: string, requesterId: string, targetUserId: string, isAdmin: boolean) =>
        setAdmin.execute({ groupId, requesterId, targetUserId, isAdmin }),
      transferOwner: (groupId: string, requesterId: string, newOwnerId: string) =>
        transferOwner.execute({ groupId, requesterId, newOwnerId }),
      getPendingMembers: (groupId: string, requesterId: string) =>
        getPendingMembers.query({ groupId, requesterId }),
      approveMember: (groupId: string, userId: string, requesterId: string) =>
        approveMember.execute({ groupId, userId, requesterId }),
      rejectMember: (groupId: string, userId: string, requesterId: string) =>
        rejectMember.execute({ groupId, userId, requesterId }),
      sendMessage: (
        conversationId: string,
        senderId: string,
        text?: string,
        media?: any[],
        ttlSeconds?: number,
        clientMessageId?: string,
      ) => sendMessage.execute({ conversationId, senderId, text, media, ttlSeconds, clientMessageId }),
      sendGroupMessage: (
        conversationId: string,
        senderId: string,
        text?: string,
        media?: any[],
        ttlSeconds?: number,
        clientMessageId?: string,
      ) => sendGroupMessage.execute({ conversationId, senderId, text, media, ttlSeconds, clientMessageId }),
      loadMessages: (conversationId: string, userId: string, cursor: string | undefined, limit: number) =>
        loadMessages.query({ conversationId, userId, cursor, limit }),
      markAsSeen: (conversationId: string, userId: string, lastSeenMessageId: string) =>
        markAsSeen.execute({ conversationId, userId, lastSeenMessageId }),
      markAsDelivered: (conversationId: string, userId: string, lastDeliveredMessageId: string) =>
        markAsDelivered.execute({ conversationId, userId, lastDeliveredMessageId }),
      revokeMessage: (messageId: string, userId: string) => revokeMessage.execute({ messageId, userId }),
      deleteMessageForMe: (messageId: string, userId: string) => deleteMessageForMe.execute({ messageId, userId }),
      deleteMessageForEveryone: (messageId: string, userId: string) =>
        deleteMessageForEveryone.execute({ messageId, userId }),
      editMessage: (messageId: string, userId: string, text: string, timeLimitMs?: number) =>
        editMessage.execute({ messageId, userId, text, timeLimitMs }),
      forwardMessages: (userId: string, messageIds: string[], targetConversationIds: string[]) =>
        forwardMessages.execute({ userId, messageIds, targetConversationIds }),
      saveMessagesToMyDocument: (userId: string, messageIds: string[]) =>
        saveMessagesToMyDocument.execute({ userId, messageIds }),
      pinConversation: (conversationId: string, userId: string) =>
        pinConversation.execute({ conversationId, userId }),
      unpinConversation: (conversationId: string, userId: string) =>
        unpinConversation.execute({ conversationId, userId }),
      deleteConversationForMe: (conversationId: string, userId: string) =>
        deleteConversationForMe.execute({ conversationId, userId }),
      pinMessage: (messageId: string, userId: string) => pinMessage.execute({ messageId, userId }),
      unpinMessage: (messageId: string, userId: string) => unpinMessage.execute({ messageId, userId }),
      getPinnedMessages: (conversationId: string, userId: string) =>
        getPinnedMessages.query({ conversationId, userId }),
      addReaction: (messageId: string, userId: string, emoji: string) =>
        addReaction.execute({ messageId, userId, emoji }),
      removeReaction: (messageId: string, userId: string, emoji?: string) =>
        removeReaction.execute(messageId, userId, emoji),
      removeAllReactions: (messageId: string, userId: string) => removeAllReactions.execute(messageId, userId),
      getReactions: (messageId: string, userId: string) => getReactions.execute(messageId, userId),
      quoteMessage: (
        conversationId: string,
        senderId: string,
        text: string | undefined,
        media: any[] | undefined,
        quotedMessageId: string,
      ) => quoteMessage.execute({ conversationId, senderId, text, media, quotedMessageId }),
      createPoll: (
        conversationId: string,
        creatorId: string,
        question: string,
        options: string[],
        isMultipleChoice?: boolean,
        allowAddOption?: boolean,
        allowChangeVote?: boolean,
        showResultsBeforeClose?: boolean,
        expiresAt?: string,
        hideVoters?: boolean,
      ) =>
        createPoll.execute({
          conversationId,
          creatorId,
          question,
          options,
          isMultipleChoice,
          allowAddOption,
          allowChangeVote,
          showResultsBeforeClose,
          expiresAt,
          hideVoters,
        }),
      getPolls: (conversationId: string, userId: string, cursor?: string, limit?: number, status?: string) =>
        getPolls.query({ conversationId, userId, cursor, limit, status }),
      getPoll: (pollId: string, userId: string) => getPoll.query({ pollId, userId }),
      votePoll: (pollId: string, userId: string, optionIds: string[]) =>
        votePoll.execute({ pollId, userId, optionIds }),
      addPollOption: (pollId: string, userId: string, text: string) =>
        addPollOption.execute({ pollId, userId, text }),
      getPollResults: (pollId: string, userId: string) => getPollResults.query({ pollId, userId }),
      closePoll: (pollId: string, userId: string) => closePoll.execute({ pollId, userId }),
      pinPoll: (pollId: string, userId: string) => pinPoll.execute({ pollId, userId }),
      unpinPoll: (pollId: string, userId: string) => unpinPoll.execute({ pollId, userId }),
      deletePoll: (pollId: string, userId: string) => deletePoll.execute({ pollId, userId }),
      createGroupReminder: (
        conversationId: string,
        userId: string,
        title: string,
        description: string | undefined,
        remindAt: string,
        repeatRule?: any,
        notifyBeforeMinutes?: number,
      ) => createGroupReminder.execute({ conversationId, userId, title, description, remindAt, repeatRule, notifyBeforeMinutes }),
      listGroupReminders: (conversationId: string, userId: string) =>
        listGroupReminders.query({ conversationId, userId }),
      updateGroupReminder: (
        reminderId: string,
        userId: string,
        data: {
          title?: string;
          description?: string | null;
          remindAt?: string;
          repeatRule?: any;
          notifyBeforeMinutes?: number;
          status?: any;
        },
      ) => updateGroupReminder.execute({ reminderId, userId, ...data }),
      deleteGroupReminder: (reminderId: string, userId: string) =>
        deleteGroupReminder.execute({ reminderId, userId }),
      pinGroupReminder: (reminderId: string, userId: string) =>
        pinGroupReminder.execute({ reminderId, userId }),
      unpinGroupReminder: (reminderId: string, userId: string) =>
        unpinGroupReminder.execute({ reminderId, userId }),
      createGroupNote: (conversationId: string, userId: string, title: string, content: string) =>
        createGroupNote.execute({ conversationId, userId, title, content }),
      listGroupNotes: (conversationId: string, userId: string) => listGroupNotes.query({ conversationId, userId }),
      updateGroupNote: (noteId: string, userId: string, data: { title?: string; content?: string }) =>
        updateGroupNote.execute({ noteId, userId, ...data }),
      deleteGroupNote: (noteId: string, userId: string) => deleteGroupNote.execute({ noteId, userId }),
      getMessage: (messageId: string) => messageRepo.get(messageId),
      searchMessages: (
        conversationId: string,
        userId: string,
        query: string,
        cursor?: string,
        limit?: number,
        options?: { from?: Date; to?: Date; contextLimit?: number },
      ) => searchMessages.query({
        conversationId,
        userId,
        query,
        cursor,
        limit: limit || 20,
        from: options?.from?.toISOString(),
        to: options?.to?.toISOString(),
        contextLimit: options?.contextLimit,
      }),
      getConversationMedia: (
        conversationId: string,
        userId: string,
        cursor: string | undefined,
        limit: number,
        type: "all" | "image" | "file" | "link" | "video" | "voice",
      ) => getConversationMedia.query({ conversationId, userId, cursor, limit, type }),
    },
  };
}
