import { SocketEvent } from "@modules/chat/constants/socket-events";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  GroupReminderStatus,
  PollStatus,
} from "@modules/chat/model";
import {
  createLiveChatE2EHarness,
  emitWithAck,
  eventually,
  LiveChatE2EHarness,
  seedFriendship,
  seedGroupConversation,
  seedUser,
  waitForSocketEvent,
} from "./helpers/chat-live-e2e-harness";

const liveDescribe = process.env.RUN_LIVE_CHAT_E2E === "true" ? describe : describe.skip;

async function joinGroupSocket(harness: LiveChatE2EHarness, userId: string, conversationId: string) {
  const socket = await harness.connectMessagesSocket(userId);
  const ack = await emitWithAck<any>(socket, SocketEvent.JOIN_GROUP, { conversationId });
  expect(ack.success).toBe(true);
  return socket;
}

liveDescribe("group utilities live E2E with real app and DynamoDB repositories", () => {
  let harness: LiveChatE2EHarness;

  jest.setTimeout(80_000);

  beforeEach(async () => {
    harness = await createLiveChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("creates a group with owner role and default open invite settings", async () => {
    const owner = await seedUser(harness, "Live Group Owner");
    const memberA = await seedUser(harness, "Live Group A");
    const memberB = await seedUser(harness, "Live Group B");
    await seedFriendship(harness, owner.id, memberA.id);
    await seedFriendship(harness, owner.id, memberB.id);

    const response = await harness.api.post(
      "/v2/groups",
      { name: "Live Owner Group", memberIds: [memberA.id, memberB.id] },
      owner.id,
    );

    expect(response.status).toBe(201);
    const conversation = response.data.data.conversation;
    harness.trackConversation(conversation.id);
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

    await eventually(async () => {
      const ownerMember = await harness.repos.member.findByCond({
        conversationId: conversation.id,
        userId: owner.id,
      });
      expect(ownerMember?.role).toBe(ConversationMemberRole.OWNER);
    });
  });

  it("allows member invites by default, supports approval, and blocks regular members when admins-only is configured", async () => {
    const { owner, admin, member, conversation } = await seedGroupConversation(harness);
    const activeInvitee = await seedUser(harness, "Live Active Invitee");
    const pendingInvitee = await seedUser(harness, "Live Pending Invitee");
    const blockedInvitee = await seedUser(harness, "Live Blocked Invitee");
    const adminInvitee = await seedUser(harness, "Live Admin Invitee");
    await Promise.all([
      seedFriendship(harness, member.id, activeInvitee.id),
      seedFriendship(harness, member.id, pendingInvitee.id),
      seedFriendship(harness, member.id, blockedInvitee.id),
      seedFriendship(harness, admin.id, adminInvitee.id),
    ]);

    const defaultAdd = await harness.api.post(
      `/v2/groups/${conversation.id}/members`,
      { memberIds: [activeInvitee.id] },
      member.id,
    );
    expect(defaultAdd.status).toBe(200);
    expect(defaultAdd.data.data[0]).toEqual(
      expect.objectContaining({
        userId: activeInvitee.id,
        status: ConversationMemberStatus.ACTIVE,
      }),
    );

    const requireApproval = await harness.api.patch(
      `/v2/groups/${conversation.id}/settings`,
      { requireApproval: true },
      owner.id,
    );
    expect(requireApproval.status).toBe(200);

    const pendingAdd = await harness.api.post(
      `/v2/groups/${conversation.id}/members`,
      { memberIds: [pendingInvitee.id] },
      member.id,
    );
    expect(pendingAdd.status).toBe(200);
    expect(pendingAdd.data.data[0].status).toBe(ConversationMemberStatus.PENDING);

    const restrictAdd = await harness.api.patch(
      `/v2/groups/${conversation.id}/settings`,
      { whoCanAddMembers: "admins" },
      owner.id,
    );
    expect(restrictAdd.status).toBe(200);

    const blockedAdd = await harness.api.post(
      `/v2/groups/${conversation.id}/members`,
      { memberIds: [blockedInvitee.id] },
      member.id,
    );
    expect(blockedAdd.status).toBe(403);

    const adminAdd = await harness.api.post(
      `/v2/groups/${conversation.id}/members`,
      { memberIds: [adminInvitee.id] },
      admin.id,
    );
    expect(adminAdd.status).toBe(200);
    expect(adminAdd.data.data[0].status).toBe(ConversationMemberStatus.PENDING);
  });

  it("supports polls with hidden results, lock, pin, unpin, and socket events against the real app", async () => {
    const { owner, member, conversation } = await seedGroupConversation(harness);
    const ownerSocket = await joinGroupSocket(harness, owner.id, conversation.id);
    const memberSocket = await joinGroupSocket(harness, member.id, conversation.id);

    const pollCreated = waitForSocketEvent<any>(
      memberSocket,
      SocketEvent.POLL_NEW,
      (payload) => payload.conversationId === conversation.id,
    );
    const createAck = await emitWithAck<any>(ownerSocket, SocketEvent.CREATE_POLL, {
      conversationId: conversation.id,
      question: "Live pick one",
      options: ["A", "B"],
      showResultsBeforeClose: false,
    });
    expect(createAck.success).toBe(true);
    await expect(pollCreated).resolves.toEqual(expect.objectContaining({ conversationId: conversation.id }));

    const poll = createAck.poll;
    const ownerVote = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
      { optionIds: [poll.options[1].id] },
      owner.id,
    );
    expect(ownerVote.status).toBe(200);

    const memberVote = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
      { optionIds: [poll.options[0].id] },
      member.id,
    );
    expect(memberVote.status).toBe(200);

    const memberResults = await harness.api.get(`/v1/groups/${conversation.id}/polls/${poll.id}/results`, member.id);
    expect(memberResults.status).toBe(200);
    expect(memberResults.data.data.options[0]).toEqual(
      expect.objectContaining({ voteCount: 1, votedUserIds: [member.id] }),
    );
    expect(memberResults.data.data.options[1]).toEqual(
      expect.objectContaining({ voteCount: 0, votedUserIds: [] }),
    );

    const ownerResults = await harness.api.get(`/v1/groups/${conversation.id}/polls/${poll.id}/results`, owner.id);
    expect(ownerResults.status).toBe(200);
    expect(ownerResults.data.data.options.map((option: any) => option.voteCount)).toEqual([1, 1]);

    const pinned = waitForSocketEvent<any>(memberSocket, SocketEvent.POLL_PINNED, (payload) => payload.pollId === poll.id);
    const pinAck = await emitWithAck<any>(ownerSocket, SocketEvent.PIN_POLL, { pollId: poll.id });
    expect(pinAck.success).toBe(true);
    expect(pinAck.poll.pinned).toBe(true);
    await expect(pinned).resolves.toEqual(expect.objectContaining({ pinnedBy: owner.id }));

    const unpinned = waitForSocketEvent<any>(memberSocket, SocketEvent.POLL_UNPINNED, (payload) => payload.pollId === poll.id);
    const unpinAck = await emitWithAck<any>(ownerSocket, SocketEvent.UNPIN_POLL, { pollId: poll.id });
    expect(unpinAck.success).toBe(true);
    expect(unpinAck.poll.pinned).toBe(false);
    await expect(unpinned).resolves.toEqual(expect.objectContaining({ unpinnedBy: owner.id }));

    const closed = waitForSocketEvent<any>(memberSocket, SocketEvent.POLL_CLOSED, (payload) => payload.pollId === poll.id);
    const closeAck = await emitWithAck<any>(ownerSocket, SocketEvent.CLOSE_POLL, { pollId: poll.id });
    expect(closeAck.success).toBe(true);
    expect(closeAck.poll.status).toBe(PollStatus.CLOSED);
    await expect(closed).resolves.toEqual(expect.objectContaining({ closedBy: owner.id }));

    const voteAfterClose = await harness.api.post(
      `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
      { optionIds: [poll.options[0].id] },
      member.id,
    );
    expect(voteAfterClose.status).toBe(400);
  });

  it("updates group settings/info and manages reminders/notes through sockets and HTTP", async () => {
    const { owner, admin, member, conversation } = await seedGroupConversation(harness);
    const ownerSocket = await joinGroupSocket(harness, owner.id, conversation.id);
    const adminSocket = await joinGroupSocket(harness, admin.id, conversation.id);
    const memberSocket = await joinGroupSocket(harness, member.id, conversation.id);
    const remindAt = new Date(Date.now() + 120_000).toISOString();

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const memberSettingsAck = await emitWithAck<any>(memberSocket, SocketEvent.UPDATE_GROUP_SETTINGS, {
        groupId: conversation.id,
        utilityPermissions: { note: "admins" },
      });
      expect(memberSettingsAck.success).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }

    const settingsEvent = waitForSocketEvent<any>(
      memberSocket,
      SocketEvent.GROUP_SETTINGS_UPDATED,
      (payload) => payload.conversationId === conversation.id,
    );
    const settingsAck = await emitWithAck<any>(ownerSocket, SocketEvent.UPDATE_GROUP_SETTINGS, {
      groupId: conversation.id,
      utilityPermissions: { reminder: "admins", note: "admins" },
    });
    expect(settingsAck.success).toBe(true);
    await expect(settingsEvent).resolves.toEqual(
      expect.objectContaining({
        settings: expect.objectContaining({
          utilityPermissions: expect.objectContaining({ reminder: "admins", note: "admins" }),
        }),
      }),
    );

    const renameEvent = waitForSocketEvent<any>(
      memberSocket,
      SocketEvent.GROUP_RENAMED,
      (payload) => payload.conversationId === conversation.id,
    );
    const renameAck = await emitWithAck<any>(ownerSocket, SocketEvent.UPDATE_GROUP_INFO, {
      groupId: conversation.id,
      name: "Live Socket Team",
    });
    expect(renameAck.success).toBe(true);
    await expect(renameEvent).resolves.toEqual(expect.objectContaining({ newName: "Live Socket Team" }));

    const blockedNote = await harness.api.post(
      `/v1/groups/${conversation.id}/notes`,
      { title: "Blocked", content: "Member cannot create" },
      member.id,
    );
    expect(blockedNote.status).toBe(403);

    const noteCreated = waitForSocketEvent<any>(
      memberSocket,
      SocketEvent.GROUP_NOTE_CREATED,
      (payload) => payload.conversationId === conversation.id,
    );
    const noteAck = await emitWithAck<any>(adminSocket, SocketEvent.CREATE_NOTE, {
      conversationId: conversation.id,
      title: "Live note",
      content: "Socket note",
    });
    expect(noteAck.success).toBe(true);
    await expect(noteCreated).resolves.toEqual(
      expect.objectContaining({ note: expect.objectContaining({ title: "Live note" }) }),
    );

    const noteUpdate = await emitWithAck<any>(adminSocket, SocketEvent.UPDATE_NOTE, {
      noteId: noteAck.note.id,
      content: "Updated note",
    });
    expect(noteUpdate.success).toBe(true);
    expect(noteUpdate.note.content).toBe("Updated note");

    const deleteNote = await emitWithAck<any>(adminSocket, SocketEvent.DELETE_NOTE, {
      noteId: noteAck.note.id,
      conversationId: conversation.id,
    });
    expect(deleteNote.success).toBe(true);

    const reminderCreated = waitForSocketEvent<any>(
      memberSocket,
      SocketEvent.GROUP_REMINDER_CREATED,
      (payload) => payload.conversationId === conversation.id,
    );
    const reminderAck = await emitWithAck<any>(adminSocket, SocketEvent.CREATE_REMINDER, {
      conversationId: conversation.id,
      title: "Live reminder",
      remindAt,
    });
    expect(reminderAck.success).toBe(true);
    await expect(reminderCreated).resolves.toEqual(
      expect.objectContaining({ reminder: expect.objectContaining({ title: "Live reminder" }) }),
    );

    const reminderUpdate = await harness.api.put(
      `/v1/groups/${conversation.id}/reminders/${reminderAck.reminder.id}`,
      { title: "Done reminder", status: GroupReminderStatus.DONE },
      owner.id,
    );
    expect(reminderUpdate.status).toBe(200);
    expect(reminderUpdate.data.data.title).toBe("Done reminder");

    const reminderDelete = await harness.api.delete(
      `/v1/groups/${conversation.id}/reminders/${reminderAck.reminder.id}`,
      owner.id,
    );
    expect(reminderDelete.status).toBe(200);
  });
});
