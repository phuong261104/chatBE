import { SocketEvent } from "@modules/chat/constants/socket-events";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  MessageType,
  GroupReminderStatus,
  PollStatus,
} from "@modules/chat/model";
import {
  authHeader,
  ChatE2EHarness,
  createChatE2EHarness,
  emitWithAck,
  seedGroupConversation,
  waitForSocketEvent,
} from "./helpers/chat-e2e-harness";

async function joinGroupSocket(harness: ChatE2EHarness, userId: string, conversationId: string) {
  const socket = await harness.connectMessagesSocket(userId);
  const ack = await emitWithAck<any>(socket, SocketEvent.JOIN_GROUP, { conversationId });
  expect(ack.success).toBe(true);
  return socket;
}

async function expectNoSocketEvent(socket: any, event: string, timeoutMs = 150) {
  await new Promise<void>((resolve, reject) => {
    const onEvent = (payload: unknown) => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      reject(new Error(`Unexpected socket event ${event}: ${JSON.stringify(payload)}`));
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, timeoutMs);
    socket.once(event, onEvent);
  });
}

function addFriendshipsWith(harness: ChatE2EHarness, userId: string, otherUserIds: string[]) {
  for (const otherUserId of otherUserIds) {
    harness.store.addFriendship(userId, otherUserId);
  }
}

describe("group utilities, owner role, and permissions E2E", () => {
  let harness: ChatE2EHarness;

  beforeEach(async () => {
    harness = await createChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("creates groups with an owner role and preserves owner/admin roles across admin and owner transfers", async () => {
    const owner = harness.store.addUser({ displayName: "Owner" });
    const adminCandidate = harness.store.addUser({ displayName: "Admin candidate" });
    const newOwner = harness.store.addUser({ displayName: "New owner" });
    addFriendshipsWith(harness, owner.id, [adminCandidate.id, newOwner.id]);

    const createResponse = await harness.api.post(
      "/v1/groups",
      { name: "Owners", memberIds: [adminCandidate.id, newOwner.id] },
      { headers: authHeader(owner.id) },
    );

    expect(createResponse.status).toBe(201);
    const conversation = createResponse.data.data.conversation;
    expect(conversation.ownerId).toBe(owner.id);
    expect(conversation.admins).toEqual([]);
    expect(conversation.settings).toEqual(
      expect.objectContaining({
        requireApproval: false,
        allowMemberInvite: true,
        whoCanAddMembers: "all",
        whoCanSendMessages: "all",
        utilityPermissions: { poll: "all", reminder: "all", note: "all" },
      }),
    );
    expect(harness.store.getMember(conversation.id, owner.id)?.role).toBe(ConversationMemberRole.OWNER);

    const setAdminResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/set-admin`,
      { targetUserId: adminCandidate.id, isAdmin: true },
      { headers: authHeader(owner.id) },
    );

    expect(setAdminResponse.status).toBe(200);
    expect(harness.store.getMember(conversation.id, owner.id)?.role).toBe(ConversationMemberRole.OWNER);
    expect(harness.store.getMember(conversation.id, adminCandidate.id)?.role).toBe(ConversationMemberRole.ADMIN);
    expect(harness.store.conversations.get(conversation.id)?.admins).toEqual([adminCandidate.id]);
    expect(harness.socketEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "user",
          targetId: adminCandidate.id,
          event: SocketEvent.RECEIVE_MESSAGE,
          data: expect.objectContaining({
            conversationId: conversation.id,
            message: expect.objectContaining({
              conversationId: conversation.id,
              senderId: owner.id,
              type: MessageType.SYSTEM,
            }),
          }),
        }),
      ]),
    );

    const transferResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/transfer-owner`,
      { newOwnerId: newOwner.id },
      { headers: authHeader(owner.id) },
    );

    expect(transferResponse.status).toBe(200);
    expect(harness.store.conversations.get(conversation.id)?.ownerId).toBe(newOwner.id);
    expect(harness.store.getMember(conversation.id, newOwner.id)?.role).toBe(ConversationMemberRole.OWNER);
    expect(harness.store.getMember(conversation.id, owner.id)?.role).toBe(ConversationMemberRole.ADMIN);
    expect(harness.store.conversations.get(conversation.id)?.admins).toEqual(
      expect.arrayContaining([adminCandidate.id, owner.id]),
    );
  });

  it("auto-transfers owner role when the owner leaves a group", async () => {
    const { owner, admin, conversation } = seedGroupConversation(harness.store);

    const leaveResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/leave`,
      {},
      { headers: authHeader(owner.id) },
    );

    expect(leaveResponse.status).toBe(200);
    expect(harness.store.conversations.get(conversation.id)?.ownerId).toBe(admin.id);
    expect(harness.store.getMember(conversation.id, admin.id)?.role).toBe(ConversationMemberRole.OWNER);
    expect(harness.store.getMember(conversation.id, owner.id)?.leftAt).toBeTruthy();
  });

  it("allows member invites by default, supports approval, and restricts add-member permission when configured", async () => {
    const { owner, admin, member, conversation } = seedGroupConversation(harness.store);
    const activeInvitee = harness.store.addUser({ displayName: "Active invitee" });
    const pendingInvitee = harness.store.addUser({ displayName: "Pending invitee" });
    const blockedInvitee = harness.store.addUser({ displayName: "Blocked invitee" });
    const groupBlockedInvitee = harness.store.addUser({ displayName: "Group blocked invitee" });
    const adminInvitee = harness.store.addUser({ displayName: "Admin invitee" });
    addFriendshipsWith(harness, member.id, [activeInvitee.id, pendingInvitee.id, blockedInvitee.id]);
    addFriendshipsWith(harness, admin.id, [adminInvitee.id, groupBlockedInvitee.id]);

    const defaultAddResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/members`,
      { memberIds: [activeInvitee.id] },
      { headers: authHeader(member.id) },
    );

    expect(defaultAddResponse.status).toBe(200);
    expect(defaultAddResponse.data.data[0]).toEqual(
      expect.objectContaining({
        userId: activeInvitee.id,
        status: ConversationMemberStatus.ACTIVE,
      }),
    );

    const requireApprovalResponse = await harness.api.patch(
      `/v1/groups/${conversation.id}/settings`,
      { requireApproval: true },
      { headers: authHeader(owner.id) },
    );
    expect(requireApprovalResponse.status).toBe(200);

    const pendingAddResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/members`,
      { memberIds: [pendingInvitee.id] },
      { headers: authHeader(member.id) },
    );
    expect(pendingAddResponse.status).toBe(200);
    expect(pendingAddResponse.data.data[0].status).toBe(ConversationMemberStatus.PENDING);

    const pendingListResponse = await harness.api.get(
      `/v1/groups/${conversation.id}/pending-members`,
      { headers: authHeader(owner.id) },
    );
    expect(pendingListResponse.status).toBe(200);
    expect(pendingListResponse.data.data.map((item: any) => item.userId)).toContain(pendingInvitee.id);

    const restrictAddResponse = await harness.api.patch(
      `/v1/groups/${conversation.id}/settings`,
      { whoCanAddMembers: "admins" },
      { headers: authHeader(owner.id) },
    );
    expect(restrictAddResponse.status).toBe(200);

    const memberBlockedResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/members`,
      { memberIds: [blockedInvitee.id] },
      { headers: authHeader(member.id) },
    );
    expect(memberBlockedResponse.status).toBe(403);

    const adminAddResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/members`,
      { memberIds: [adminInvitee.id] },
      { headers: authHeader(admin.id) },
    );
    expect(adminAddResponse.status).toBe(200);
    expect(adminAddResponse.data.data[0].status).toBe(ConversationMemberStatus.ACTIVE);
    expect(harness.socketEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "user",
          targetId: adminInvitee.id,
          event: SocketEvent.CONVERSATION_CREATED,
          data: expect.objectContaining({
            conversation: expect.objectContaining({ id: conversation.id }),
            addedBy: admin.id,
          }),
        }),
      ]),
    );

    const groupBlockResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/blocks`,
      { targetUserId: groupBlockedInvitee.id },
      { headers: authHeader(owner.id) },
    );
    expect(groupBlockResponse.status).toBe(200);

    const groupBlockedAddResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/members`,
      { memberIds: [groupBlockedInvitee.id] },
      { headers: authHeader(admin.id) },
    );
    expect(groupBlockedAddResponse.status).toBe(403);
    expect(harness.store.getMember(conversation.id, groupBlockedInvitee.id)).toBeUndefined();
  });

  it("emits user-room updates for group leave and approval so ChatList can sync without group-room cache", async () => {
    const { owner, admin, member, conversation } = seedGroupConversation(harness.store);
    const pendingInvitee = harness.store.addUser({ displayName: "Pending invitee" });
    const leaver = harness.store.addUser({ displayName: "Leaver" });
    addFriendshipsWith(harness, member.id, [pendingInvitee.id]);
    addFriendshipsWith(harness, owner.id, [leaver.id]);

    await harness.api.patch(
      `/v1/groups/${conversation.id}/settings`,
      { requireApproval: true },
      { headers: authHeader(owner.id) },
    );

    const pendingAddResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/members`,
      { memberIds: [pendingInvitee.id] },
      { headers: authHeader(member.id) },
    );
    expect(pendingAddResponse.status).toBe(200);
    expect(pendingAddResponse.data.data[0].status).toBe(ConversationMemberStatus.PENDING);

    const approveResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/members/${pendingInvitee.id}/approve`,
      {},
      { headers: authHeader(owner.id) },
    );
    expect(approveResponse.status).toBe(200);

    expect(harness.socketEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "user",
          targetId: pendingInvitee.id,
          event: SocketEvent.CONVERSATION_CREATED,
          data: expect.objectContaining({
            conversation: expect.objectContaining({ id: conversation.id }),
            approvedBy: owner.id,
          }),
        }),
        expect.objectContaining({
          target: "user",
          targetId: pendingInvitee.id,
          event: SocketEvent.GROUP_MEMBER_APPROVED,
        }),
      ]),
    );

    const activeAddResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/members`,
      { memberIds: [leaver.id] },
      { headers: authHeader(owner.id) },
    );
    expect(activeAddResponse.status).toBe(200);
    expect(activeAddResponse.data.data[0].status).toBe(ConversationMemberStatus.ACTIVE);

    const leaveResponse = await harness.api.post(
      `/v1/groups/${conversation.id}/leave`,
      {},
      { headers: authHeader(leaver.id) },
    );
    expect(leaveResponse.status).toBe(200);

    expect(harness.socketEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "user",
          targetId: owner.id,
          event: SocketEvent.GROUP_MEMBER_LEFT,
          data: expect.objectContaining({ conversationId: conversation.id, leftUserId: leaver.id }),
        }),
        expect.objectContaining({
          target: "user",
          targetId: leaver.id,
          event: SocketEvent.CONVERSATION_MEMBER_REMOVED,
          data: expect.objectContaining({ conversationId: conversation.id, removedUserId: leaver.id }),
        }),
        expect.objectContaining({
          target: "user",
          targetId: admin.id,
          event: SocketEvent.RECEIVE_MESSAGE,
          data: expect.objectContaining({
            conversationId: conversation.id,
            message: expect.objectContaining({ type: MessageType.SYSTEM }),
          }),
        }),
      ]),
    );
  });

  it("supports polls with hidden results, lock, pin, unpin, and socket events", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const ownerSocket = await joinGroupSocket(harness, owner.id, conversation.id);
    const memberSocket = await joinGroupSocket(harness, member.id, conversation.id);

    const pollCardCreated = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);
    const pollCreated = waitForSocketEvent<any>(memberSocket, SocketEvent.POLL_NEW);
    const createPollAck = await emitWithAck<any>(ownerSocket, SocketEvent.CREATE_POLL, {
      conversationId: conversation.id,
      question: "Pick one",
      options: ["A", "B"],
      showResultsBeforeClose: false,
    });
    expect(createPollAck.success).toBe(true);
    const pollCard = await pollCardCreated;
    await expect(pollCreated).resolves.toEqual(expect.objectContaining({ conversationId: conversation.id }));

    const poll = createPollAck.poll;
    expect(poll.messageId).toBe(pollCard.message.id);
    expect(pollCard.message).toEqual(
      expect.objectContaining({ type: MessageType.POLL, pollId: poll.id, conversationId: conversation.id }),
    );
    expect(harness.store.conversations.get(conversation.id)?.lastMessage?.messageId).toBe(poll.messageId);

    const firstVoteActivity = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);
    const ownerVote = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
      { optionIds: [poll.options[1].id] },
      { headers: authHeader(owner.id) },
    );
    expect(ownerVote.status).toBe(200);
    const firstActivity = await firstVoteActivity;
    expect(firstActivity).toEqual(
      expect.objectContaining({
        message: expect.objectContaining({ type: MessageType.SYSTEM, systemAction: "poll_vote_activity", pollId: poll.id }),
      }),
    );
    expect(firstActivity.message.text).toContain("1 thành viên");

    const voteActivity = waitForSocketEvent<any>(memberSocket, SocketEvent.MESSAGE_EDITED);
    const memberVote = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
      { optionIds: [poll.options[0].id] },
      { headers: authHeader(member.id) },
    );
    expect(memberVote.status).toBe(200);
    const secondActivity = await voteActivity;
    expect(secondActivity).toEqual(
      expect.objectContaining({
        message: expect.objectContaining({ type: MessageType.SYSTEM, systemAction: "poll_vote_activity", pollId: poll.id }),
      }),
    );
    expect(secondActivity.message.text).toContain("2 thành viên");

    const memberResults = await harness.api.get(
      `/v1/groups/${conversation.id}/polls/${poll.id}/results`,
      { headers: authHeader(member.id) },
    );
    expect(memberResults.status).toBe(200);
    expect(memberResults.data.data.options[0]).toEqual(
      expect.objectContaining({ voteCount: 1, votedUserIds: [member.id] }),
    );
    expect(memberResults.data.data.options[1]).toEqual(
      expect.objectContaining({ voteCount: 0, votedUserIds: [] }),
    );

    const ownerResults = await harness.api.get(
      `/v1/groups/${conversation.id}/polls/${poll.id}/results`,
      { headers: authHeader(owner.id) },
    );
    expect(ownerResults.data.data.options.map((option: any) => option.voteCount)).toEqual([1, 1]);

    const noRepeatMessage = expectNoSocketEvent(memberSocket, SocketEvent.RECEIVE_MESSAGE);
    const noRepeatEdit = expectNoSocketEvent(memberSocket, SocketEvent.MESSAGE_EDITED);
    const noRepeatPollVote = expectNoSocketEvent(memberSocket, SocketEvent.POLL_VOTE);
    const repeatOwnerVote = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
      { optionIds: [poll.options[1].id] },
      { headers: authHeader(owner.id) },
    );
    expect(repeatOwnerVote.status).toBe(200);
    expect(repeatOwnerVote.data.data.options.map((option: any) => option.voteCount)).toEqual([1, 1]);
    await Promise.all([noRepeatMessage, noRepeatEdit, noRepeatPollVote]);
    expect(harness.store.getMessage(secondActivity.message.id)?.text).toContain("2 thành viên");

    const singleChoice = await harness.api.post(
      `/v1/groups/${conversation.id}/polls`,
      { question: "Single", options: ["X", "Y"], isMultipleChoice: false },
      { headers: authHeader(owner.id) },
    );
    expect(singleChoice.status).toBe(201);
    const badVote = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${singleChoice.data.data.poll.id}/vote`,
      { optionIds: singleChoice.data.data.poll.options.map((option: any) => option.id) },
      { headers: authHeader(member.id) },
    );
    expect(badVote.status).toBe(400);

    const multipleChoice = await harness.api.post(
      `/v1/groups/${conversation.id}/polls`,
      { question: "Multiple", options: ["X", "Y"], isMultipleChoice: true },
      { headers: authHeader(owner.id) },
    );
    expect(multipleChoice.status).toBe(201);
    const multiVote = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${multipleChoice.data.data.poll.id}/vote`,
      { optionIds: multipleChoice.data.data.poll.options.map((option: any) => option.id) },
      { headers: authHeader(member.id) },
    );
    expect(multiVote.status).toBe(200);

    const addOptionPoll = await harness.api.post(
      `/v1/groups/${conversation.id}/polls`,
      { question: "Add option", options: ["X", "Y"], allowAddOption: true },
      { headers: authHeader(owner.id) },
    );
    expect(addOptionPoll.status).toBe(201);
    const addedOption = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${addOptionPoll.data.data.poll.id}/options`,
      { text: "Z" },
      { headers: authHeader(member.id) },
    );
    expect(addedOption.status).toBe(200);
    expect(addedOption.data.data.options.map((option: any) => option.text)).toContain("Z");

    const pinned = waitForSocketEvent<any>(memberSocket, SocketEvent.POLL_PINNED);
    const pinAck = await emitWithAck<any>(ownerSocket, SocketEvent.PIN_POLL, { pollId: poll.id });
    expect(pinAck.success).toBe(true);
    expect(pinAck.poll.pinned).toBe(true);
    expect(harness.store.getMessage(poll.messageId)).toEqual(expect.objectContaining({ pinned: true }));
    await expect(pinned).resolves.toEqual(expect.objectContaining({ pollId: poll.id, pinnedBy: owner.id }));

    const unpinned = waitForSocketEvent<any>(memberSocket, SocketEvent.POLL_UNPINNED);
    const unpinAck = await emitWithAck<any>(ownerSocket, SocketEvent.UNPIN_POLL, { pollId: poll.id });
    expect(unpinAck.success).toBe(true);
    expect(unpinAck.poll.pinned).toBe(false);
    expect(harness.store.getMessage(poll.messageId)).toEqual(expect.objectContaining({ pinned: false }));
    await expect(unpinned).resolves.toEqual(expect.objectContaining({ pollId: poll.id, unpinnedBy: owner.id }));

    const closed = waitForSocketEvent<any>(memberSocket, SocketEvent.POLL_CLOSED);
    const closeAck = await emitWithAck<any>(ownerSocket, SocketEvent.CLOSE_POLL, { pollId: poll.id });
    expect(closeAck.success).toBe(true);
    expect(closeAck.poll.status).toBe(PollStatus.CLOSED);
    await expect(closed).resolves.toEqual(expect.objectContaining({ pollId: poll.id, closedBy: owner.id }));

    const voteAfterClose = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
      { optionIds: [poll.options[0].id] },
      { headers: authHeader(member.id) },
    );
    expect(voteAfterClose.status).toBe(400);
  });

  it("updates group settings and group info through sockets with owner/admin permission checks", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const ownerSocket = await joinGroupSocket(harness, owner.id, conversation.id);
    const memberSocket = await joinGroupSocket(harness, member.id, conversation.id);

    const memberSettingsAck = await emitWithAck<any>(memberSocket, SocketEvent.UPDATE_GROUP_SETTINGS, {
      groupId: conversation.id,
      whoCanSendMessages: "admins",
    });
    expect(memberSettingsAck.success).toBe(false);

    const settingsEvent = waitForSocketEvent<any>(memberSocket, SocketEvent.GROUP_SETTINGS_UPDATED);
    const ownerSettingsAck = await emitWithAck<any>(ownerSocket, SocketEvent.UPDATE_GROUP_SETTINGS, {
      groupId: conversation.id,
      whoCanSendMessages: "admins",
      utilityPermissions: { poll: "admins" },
    });
    expect(ownerSettingsAck.success).toBe(true);
    expect(ownerSettingsAck.conversation.settings.whoCanSendMessages).toBe("admins");
    await expect(settingsEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        settings: expect.objectContaining({ whoCanSendMessages: "admins" }),
      }),
    );

    const memberInfoAck = await emitWithAck<any>(memberSocket, SocketEvent.UPDATE_GROUP_INFO, {
      groupId: conversation.id,
      name: "Nope",
    });
    expect(memberInfoAck.success).toBe(false);

    const renameEvent = waitForSocketEvent<any>(memberSocket, SocketEvent.GROUP_RENAMED);
    const ownerInfoAck = await emitWithAck<any>(ownerSocket, SocketEvent.UPDATE_GROUP_INFO, {
      groupId: conversation.id,
      name: "Socket Team",
    });
    expect(ownerInfoAck.success).toBe(true);
    expect(harness.store.conversations.get(conversation.id)?.name).toBe("Socket Team");
    await expect(renameEvent).resolves.toEqual(
      expect.objectContaining({ conversationId: conversation.id, newName: "Socket Team", renamedBy: owner.id }),
    );
  });

  it("supports group reminders and notes through HTTP and sockets with utility permissions", async () => {
    const { owner, admin, member, conversation } = seedGroupConversation(harness.store);
    const adminSocket = await joinGroupSocket(harness, admin.id, conversation.id);
    const memberSocket = await joinGroupSocket(harness, member.id, conversation.id);
    const remindAt = new Date(Date.now() + 60_000).toISOString();

    const reminderCardCreated = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);
    const memberReminder = await harness.api.post(
      `/v1/groups/${conversation.id}/reminders`,
      { title: "Member reminder", description: "Visible", remindAt, repeatRule: "weekly", notifyBeforeMinutes: 10 },
      { headers: authHeader(member.id) },
    );
    expect(memberReminder.status).toBe(201);
    const reminderCard = await reminderCardCreated;
    expect(memberReminder.data.data.messageId).toBe(reminderCard.message.id);
    expect(reminderCard.message).toEqual(
      expect.objectContaining({
        type: MessageType.REMINDER,
        reminderId: memberReminder.data.data.id,
        conversationId: conversation.id,
      }),
    );
    expect(memberReminder.data.data.repeatRule).toBe("weekly");
    expect(memberReminder.data.data.notifyBeforeMinutes).toBe(10);

    const reminders = await harness.api.get(
      `/v1/groups/${conversation.id}/reminders`,
      { headers: authHeader(member.id) },
    );
    expect(reminders.status).toBe(200);
    expect(reminders.data.data.map((item: any) => item.id)).toContain(memberReminder.data.data.id);

    const pinnedReminder = await harness.api.post(
      `/v1/groups/${conversation.id}/reminders/${memberReminder.data.data.id}/pin`,
      {},
      { headers: authHeader(owner.id) },
    );
    expect(pinnedReminder.status).toBe(200);
    expect(pinnedReminder.data.data.pinned).toBe(true);
    expect(harness.store.getMessage(memberReminder.data.data.messageId)).toEqual(expect.objectContaining({ pinned: true }));

    const updatedReminder = await harness.api.put(
      `/v1/groups/${conversation.id}/reminders/${memberReminder.data.data.id}`,
      { title: "Owner updated", status: GroupReminderStatus.DONE, repeatRule: "none", notifyBeforeMinutes: 0 },
      { headers: authHeader(owner.id) },
    );
    expect(updatedReminder.status).toBe(200);
    expect(updatedReminder.data.data.title).toBe("Owner updated");
    expect(updatedReminder.data.data.repeatRule).toBe("none");

    const deletedReminder = await harness.api.delete(
      `/v1/groups/${conversation.id}/reminders/${memberReminder.data.data.id}`,
      { headers: authHeader(owner.id) },
    );
    expect(deletedReminder.status).toBe(200);
    expect(harness.store.reminders.get(memberReminder.data.data.id)?.status).toBe(GroupReminderStatus.CANCELLED);

    const memberNote = await harness.api.post(
      `/v1/groups/${conversation.id}/notes`,
      { title: "Member note", content: "Open by default" },
      { headers: authHeader(member.id) },
    );
    expect(memberNote.status).toBe(201);

    const restrictUtilities = await harness.api.patch(
      `/v1/groups/${conversation.id}/settings`,
      { utilityPermissions: { reminder: "admins", note: "admins" } },
      { headers: authHeader(owner.id) },
    );
    expect(restrictUtilities.status).toBe(200);

    const blockedNote = await harness.api.post(
      `/v1/groups/${conversation.id}/notes`,
      { title: "Blocked", content: "Member cannot create now" },
      { headers: authHeader(member.id) },
    );
    expect(blockedNote.status).toBe(403);

    const noteCreated = waitForSocketEvent<any>(memberSocket, SocketEvent.GROUP_NOTE_CREATED);
    const noteAck = await emitWithAck<any>(adminSocket, SocketEvent.CREATE_NOTE, {
      conversationId: conversation.id,
      title: "Admin note",
      content: "Socket note",
    });
    expect(noteAck.success).toBe(true);
    await expect(noteCreated).resolves.toEqual(
      expect.objectContaining({ conversationId: conversation.id, note: expect.objectContaining({ title: "Admin note" }) }),
    );

    const noteUpdated = waitForSocketEvent<any>(memberSocket, SocketEvent.GROUP_NOTE_UPDATED);
    const updateNoteAck = await emitWithAck<any>(adminSocket, SocketEvent.UPDATE_NOTE, {
      noteId: noteAck.note.id,
      content: "Updated over socket",
    });
    expect(updateNoteAck.success).toBe(true);
    expect(updateNoteAck.note.content).toBe("Updated over socket");
    await expect(noteUpdated).resolves.toEqual(expect.objectContaining({ note: expect.objectContaining({ id: noteAck.note.id }) }));

    const noteDeleted = waitForSocketEvent<any>(memberSocket, SocketEvent.GROUP_NOTE_DELETED);
    const deleteNoteAck = await emitWithAck<any>(adminSocket, SocketEvent.DELETE_NOTE, {
      noteId: noteAck.note.id,
      conversationId: conversation.id,
    });
    expect(deleteNoteAck.success).toBe(true);
    await expect(noteDeleted).resolves.toEqual(expect.objectContaining({ noteId: noteAck.note.id }));

    const reminderCreated = waitForSocketEvent<any>(memberSocket, SocketEvent.GROUP_REMINDER_CREATED);
    const reminderAck = await emitWithAck<any>(adminSocket, SocketEvent.CREATE_REMINDER, {
      conversationId: conversation.id,
      title: "Admin reminder",
      remindAt,
    });
    expect(reminderAck.success).toBe(true);
    await expect(reminderCreated).resolves.toEqual(
      expect.objectContaining({ reminder: expect.objectContaining({ title: "Admin reminder" }) }),
    );

    const reminderUpdated = waitForSocketEvent<any>(memberSocket, SocketEvent.GROUP_REMINDER_UPDATED);
    const updateReminderAck = await emitWithAck<any>(adminSocket, SocketEvent.UPDATE_REMINDER, {
      reminderId: reminderAck.reminder.id,
      title: "Updated admin reminder",
    });
    expect(updateReminderAck.success).toBe(true);
    await expect(reminderUpdated).resolves.toEqual(
      expect.objectContaining({ reminder: expect.objectContaining({ id: reminderAck.reminder.id }) }),
    );

    const reminderDeleted = waitForSocketEvent<any>(memberSocket, SocketEvent.GROUP_REMINDER_DELETED);
    const deleteReminderAck = await emitWithAck<any>(adminSocket, SocketEvent.DELETE_REMINDER, {
      reminderId: reminderAck.reminder.id,
      conversationId: conversation.id,
    });
    expect(deleteReminderAck.success).toBe(true);
    await expect(reminderDeleted).resolves.toEqual(expect.objectContaining({ reminderId: reminderAck.reminder.id }));
  });
});
