import { SocketEvent } from "@modules/chat/constants/socket-events";
import { MessageStatus, MessageType } from "@modules/chat/model";
import {
  createLiveChatE2EHarness,
  emitWithAck,
  eventually,
  LiveChatE2EHarness,
  seedConversation,
  seedGroupConversation,
  seedMember,
  seedMessage,
  seedPrivateConversation,
  waitForSocketEvent,
} from "./helpers/chat-live-e2e-harness";
import { ConversationMemberRole, ConversationType } from "@modules/chat/model";

const TOMBSTONE_TEXT = "Tin nhắn đã được thu hồi";
const liveDescribe = process.env.RUN_LIVE_CHAT_E2E === "true" ? describe : describe.skip;

async function loadMessageIds(harness: LiveChatE2EHarness, conversationId: string, userId: string) {
  const response = await harness.api.get(`/v1/conversations/${conversationId}/messages`, userId);
  expect(response.status).toBe(200);
  return response.data.data.messages.map((message: any) => message.id);
}

liveDescribe("advanced messaging live E2E with real DynamoDB repositories", () => {
  let harness: LiveChatE2EHarness;

  jest.setTimeout(60_000);

  beforeEach(async () => {
    harness = await createLiveChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("sends messages through HTTP /v1, emits receiveMessage, and hides expired TTL messages from DB queries", async () => {
    const { owner, member, conversation } = await seedGroupConversation(harness);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const received = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);

    const response = await harness.api.post(
      `/v1/conversations/${conversation.id}/messages`,
      { text: "temporary secret", ttlSeconds: 1 },
      owner.id,
    );

    expect(response.status).toBe(201);
    const [message] = response.data.data;
    expect(message.text).toBe("temporary secret");
    expect(message.expiresAt).toBeTruthy();
    expect(message.expireAtEpoch).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000));
    await expect(received).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        message: expect.objectContaining({ id: message.id, text: "temporary secret" }),
      }),
    );

    await eventually(async () => {
      expect(await loadMessageIds(harness, conversation.id, member.id)).toContain(message.id);
    });

    await new Promise((resolve) => setTimeout(resolve, 2_100));

    await eventually(async () => {
      expect(await loadMessageIds(harness, conversation.id, member.id)).not.toContain(message.id);
    });

    const searchResponse = await harness.api.get(
      `/v1/conversations/${conversation.id}/search?query=temporary`,
      member.id,
    );
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.data.data.messages).toHaveLength(0);
  });

  it("keeps socket sendMessage aligned with HTTP /v1 TTL behavior using the real DB", async () => {
    const { owner, member, conversation } = await seedGroupConversation(harness);
    const ownerSocket = await harness.connectMessagesSocket(owner.id);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const received = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);

    const ack = await emitWithAck<any>(ownerSocket, SocketEvent.SEND_MESSAGE, {
      conversationId: conversation.id,
      text: "socket ttl",
      ttlSeconds: 30,
    });

    expect(ack.success).toBe(true);
    expect(ack.messages).toHaveLength(1);
    expect(ack.messages[0]).toEqual(
      expect.objectContaining({
        text: "socket ttl",
        expiresAt: expect.anything(),
        expireAtEpoch: expect.any(Number),
      }),
    );
    await expect(received).resolves.toEqual(
      expect.objectContaining({
        message: expect.objectContaining({ id: ack.messages[0].id }),
      }),
    );
    await eventually(async () => {
      expect(await harness.repos.message.get(ack.messages[0].id)).toEqual(
        expect.objectContaining({ text: "socket ttl", expireAtEpoch: expect.any(Number) }),
      );
    });
  });

  it("edits through HTTP /v1 within 30 seconds and rejects stale edits on HTTP and socket", async () => {
    const { owner, member, conversation } = await seedGroupConversation(harness);
    const fresh = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "before",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 10_000),
    });
    const stale = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "too late",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 31_000),
    });
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const edited = waitForSocketEvent<any>(memberSocket, SocketEvent.MESSAGE_EDITED);

    const editResponse = await harness.api.put(`/v1/messages/${fresh.id}`, { text: "after" }, owner.id);
    expect(editResponse.status).toBe(200);
    expect(editResponse.data.data).toEqual(
      expect.objectContaining({ id: fresh.id, text: "after", editedAt: expect.any(String) }),
    );
    await expect(edited).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        message: expect.objectContaining({ id: fresh.id, text: "after" }),
      }),
    );

    const staleHttpResponse = await harness.api.put(
      `/v1/messages/${stale.id}`,
      { text: "after stale" },
      owner.id,
    );
    expect(staleHttpResponse.status).toBeGreaterThanOrEqual(400);

    const ownerSocket = await harness.connectMessagesSocket(owner.id);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const staleSocketAck = await emitWithAck<any>(ownerSocket, SocketEvent.EDIT_MESSAGE, {
        messageId: stale.id,
        text: "socket should reject",
      });
      expect(staleSocketAck.success).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("updates delivered and read state through legacy HTTP and socket because no HTTP /v1 route exists", async () => {
    const { owner, member, conversation } = await seedGroupConversation(harness);
    const first = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "one",
      createdAt: new Date(Date.now() - 2_000),
    });
    const latest = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "two",
      createdAt: new Date(Date.now() - 1_000),
    });
    const memberRecord = await harness.repos.member.findByCond({
      conversationId: conversation.id,
      userId: member.id,
    });
    await harness.repos.member.update(memberRecord!.id, { unreadCount: 2 });

    const deliveredResponse = await harness.api.post(
      `/v1/conversations/${conversation.id}/delivered`,
      { lastDeliveredMessageId: first.id },
      member.id,
    );
    expect(deliveredResponse.status).toBe(200);
    await eventually(async () => {
      const saved = await harness.repos.member.findByCond({ conversationId: conversation.id, userId: member.id });
      expect(saved).toEqual(expect.objectContaining({ lastDeliveredMessageId: first.id }));
    });

    const seenResponse = await harness.api.post(
      `/v1/conversations/${conversation.id}/seen`,
      { lastSeenMessageId: latest.id },
      member.id,
    );
    expect(seenResponse.status).toBe(200);
    await eventually(async () => {
      const saved = await harness.repos.member.findByCond({ conversationId: conversation.id, userId: member.id });
      expect(saved).toEqual(
        expect.objectContaining({
          lastSeenMessageId: latest.id,
          lastReadMessageId: latest.id,
          unreadCount: 0,
        }),
      );
    });

    const ownerSocket = await harness.connectMessagesSocket(owner.id);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const deliveredEvent = waitForSocketEvent<any>(ownerSocket, SocketEvent.MESSAGE_DELIVERED);
    const seenEvent = waitForSocketEvent<any>(ownerSocket, SocketEvent.MESSAGE_SEEN);

    const deliveredAck = await emitWithAck<any>(memberSocket, SocketEvent.MESSAGE_DELIVERED, {
      conversationId: conversation.id,
      lastDeliveredMessageId: latest.id,
    });
    const seenAck = await emitWithAck<any>(memberSocket, SocketEvent.MESSAGE_SEEN, {
      conversationId: conversation.id,
      lastSeenMessageId: latest.id,
    });

    expect(deliveredAck.success).toBe(true);
    expect(seenAck.success).toBe(true);
    await expect(deliveredEvent).resolves.toEqual(
      expect.objectContaining({ conversationId: conversation.id, userId: member.id, lastDeliveredMessageId: latest.id }),
    );
    await expect(seenEvent).resolves.toEqual(
      expect.objectContaining({ conversationId: conversation.id, userId: member.id, lastSeenMessageId: latest.id }),
    );
  });

  it("recalls within 24 hours, rejects expired recall, and keeps delete-for-me local", async () => {
    const { userA: owner, userB: member, conversation } = await seedPrivateConversation(harness);
    const recallable = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "remove everywhere",
      createdAt: new Date(Date.now() - 60_000),
    });
    const old = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "too old",
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    const localOnly = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "only hidden for member",
    });
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const revokedEvent = waitForSocketEvent<any>(memberSocket, SocketEvent.MESSAGE_REVOKED);

    const revokeResponse = await harness.api.post(`/v1/messages/${recallable.id}/revoke`, {}, owner.id);
    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.data.data).toEqual(
      expect.objectContaining({
        id: recallable.id,
        text: TOMBSTONE_TEXT,
        media: [],
        links: [],
        messageStatus: MessageStatus.REVOKED,
        deletedBy: owner.id,
      }),
    );
    await expect(revokedEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        message: expect.objectContaining({ id: recallable.id, text: TOMBSTONE_TEXT }),
      }),
    );

    const expiredRecall = await harness.api.post(`/v1/messages/${old.id}/revoke`, {}, owner.id);
    expect(expiredRecall.status).toBe(403);

    const deleteForMe = await harness.api.post(`/v1/messages/${localOnly.id}/delete`, {}, member.id);
    expect(deleteForMe.status).toBe(200);
    await eventually(async () => {
      expect(await loadMessageIds(harness, conversation.id, member.id)).not.toContain(localOnly.id);
      expect(await loadMessageIds(harness, conversation.id, owner.id)).toContain(localOnly.id);
    });
  });

  it("supports socket delete-for-everyone with the same tombstone semantics as recall", async () => {
    const { userA: owner, userB: member, conversation } = await seedPrivateConversation(harness);
    const message = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "socket recall",
    });
    const ownerSocket = await harness.connectMessagesSocket(owner.id);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const deletedForEveryoneEvent = waitForSocketEvent<any>(
      memberSocket,
      SocketEvent.MESSAGE_DELETED_FOR_EVERYONE,
    );

    const ack = await emitWithAck<any>(ownerSocket, SocketEvent.DELETE_MESSAGE_FOR_EVERYONE, {
      messageId: message.id,
    });

    expect(ack.success).toBe(true);
    await eventually(async () => {
      expect(await harness.repos.message.get(message.id)).toEqual(
        expect.objectContaining({
          text: TOMBSTONE_TEXT,
          messageStatus: MessageStatus.REVOKED,
          deletedBy: owner.id,
        }),
      );
    });
    await expect(deletedForEveryoneEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        messageId: message.id,
        deletedBy: owner.id,
      }),
    );
  });

  it("quotes and forwards via HTTP fallback routes and matching socket events", async () => {
    const { owner, member, conversation } = await seedGroupConversation(harness);
    const target = await seedConversation(harness, {
      type: ConversationType.GROUP,
      name: "Live Target",
      createdBy: owner.id,
      ownerId: owner.id,
      admins: [owner.id],
      membersCount: 2,
    });
    await seedMember(harness, { conversationId: target.id, userId: owner.id, role: ConversationMemberRole.ADMIN });
    await seedMember(harness, { conversationId: target.id, userId: member.id });
    const source = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: member.id,
      text: "source context",
    });

    const quoteResponse = await harness.api.post(`/v1/messages/${source.id}/quote`, { text: "http reply" }, owner.id);
    expect(quoteResponse.status).toBe(201);
    expect(quoteResponse.data.data[0]).toEqual(
      expect.objectContaining({
        text: "http reply",
        quotedMessageId: source.id,
        quotedMessagePreview: "source context",
      }),
    );

    const forwardResponse = await harness.api.post(
      "/v1/messages/forward",
      { messageIds: [source.id], targetConversationIds: [target.id] },
      owner.id,
    );
    expect(forwardResponse.status).toBe(201);
    expect(forwardResponse.data.data[0]).toEqual(
      expect.objectContaining({
        conversationId: target.id,
        text: "source context",
        forwardedFrom: conversation.id,
        forwardedFromMessageId: source.id,
      }),
    );

    const ownerSocket = await harness.connectMessagesSocket(owner.id);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const quotedEvent = waitForSocketEvent<any>(memberSocket, SocketEvent.MESSAGE_QUOTED);

    const quoteAck = await emitWithAck<any>(ownerSocket, SocketEvent.QUOTE_MESSAGE, {
      conversationId: conversation.id,
      quotedMessageId: source.id,
      text: "socket reply",
    });
    expect(quoteAck.success).toBe(true);
    expect(quoteAck.message).toEqual(
      expect.objectContaining({ quotedMessageId: source.id, quotedMessagePreview: "source context" }),
    );
    await expect(quotedEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        quotedMessageId: source.id,
        message: expect.objectContaining({ quotedMessageId: source.id }),
      }),
    );

    const forwardedEvent = waitForSocketEvent<any>(
      memberSocket,
      SocketEvent.RECEIVE_MESSAGE,
      (payload) =>
        payload.conversationId === target.id &&
        payload.message?.forwardedFromMessageId === source.id,
    );
    const forwardAck = await emitWithAck<any>(ownerSocket, SocketEvent.FORWARD_MESSAGES, {
      messageIds: [source.id],
      targetConversationIds: [target.id],
    });
    expect(forwardAck.success).toBe(true);
    expect(forwardAck.messages[0]).toEqual(
      expect.objectContaining({ forwardedFrom: conversation.id, forwardedFromMessageId: source.id }),
    );
    await expect(forwardedEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId: target.id,
        message: expect.objectContaining({ forwardedFromMessageId: source.id }),
      }),
    );
  });

  it("aggregates reactions through HTTP fallback routes and removes them through socket", async () => {
    const { userA: owner, userB: member, conversation } = await seedPrivateConversation(harness);
    const message = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "reactable",
    });

    const reactOwner = await harness.api.post(`/v1/messages/${message.id}/react`, { emoji: "like" }, owner.id);
    const reactMember = await harness.api.post(`/v1/messages/${message.id}/react`, { emoji: "like" }, member.id);
    expect(reactOwner.status).toBe(201);
    expect(reactMember.status).toBe(201);

    const summary = await harness.api.get(`/v1/messages/${message.id}/reactions`, owner.id);
    expect(summary.status).toBe(200);
    expect(summary.data.data.grouped).toEqual({ like: 2 });
    expect(summary.data.data.reactions).toHaveLength(2);

    const ownerSocket = await harness.connectMessagesSocket(owner.id);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const removed = waitForSocketEvent<any>(ownerSocket, SocketEvent.MESSAGE_REACTION_REMOVE);

    const removeAck = await emitWithAck<any>(memberSocket, SocketEvent.REMOVE_REACTION, {
      messageId: message.id,
      emoji: "like",
    });
    expect(removeAck.success).toBe(true);
    await expect(removed).resolves.toEqual(
      expect.objectContaining({ messageId: message.id, userId: member.id, emoji: "like" }),
    );

    const updatedSummary = await harness.api.get(`/v1/messages/${message.id}/reactions`, owner.id);
    expect(updatedSummary.data.data.grouped).toEqual({ like: 1 });
  });

  it("allows private pinning by both users but rejects normal group members", async () => {
    const privateSeed = await seedPrivateConversation(harness);
    const privateMessage = await seedMessage(harness, {
      conversationId: privateSeed.conversation.id,
      senderId: privateSeed.userA.id,
      text: "pin in private",
    });

    const pinByA = await harness.api.post(`/v1/messages/${privateMessage.id}/pin`, {}, privateSeed.userA.id);
    expect(pinByA.status).toBe(200);
    expect(pinByA.data.data).toEqual(expect.objectContaining({ id: privateMessage.id, pinned: true }));

    const unpinByB = await harness.api.delete(`/v1/messages/${privateMessage.id}/pin`, privateSeed.userB.id);
    expect(unpinByB.status).toBe(200);
    expect(unpinByB.data.data).toEqual(
      expect.objectContaining({ id: privateMessage.id, pinned: false }),
    );
    expect(unpinByB.data.data.pinnedAt).toBeUndefined();

    const userBSocket = await harness.connectMessagesSocket(privateSeed.userB.id);
    const pinEvent = waitForSocketEvent<any>(
      userBSocket,
      SocketEvent.MESSAGE_PINNED,
      (payload) => payload.message.id === privateMessage.id,
    );
    const pinSystemMessage = waitForSocketEvent<any>(
      userBSocket,
      SocketEvent.RECEIVE_MESSAGE,
      (payload) =>
        payload.conversationId === privateSeed.conversation.id &&
        payload.message.type === MessageType.SYSTEM &&
        payload.message.senderId === privateSeed.userB.id,
    );
    const pinAck = await emitWithAck<any>(userBSocket, SocketEvent.PIN_MESSAGE, {
      messageId: privateMessage.id,
    });
    expect(pinAck.success).toBe(true);
    await expect(pinEvent).resolves.toEqual(
      expect.objectContaining({ message: expect.objectContaining({ id: privateMessage.id, pinned: true }) }),
    );
    const pinSystemPayload = await pinSystemMessage;
    expect(pinSystemPayload).toEqual(
      expect.objectContaining({
        conversationId: privateSeed.conversation.id,
        message: expect.objectContaining({
          id: expect.any(String),
          type: MessageType.SYSTEM,
          senderId: privateSeed.userB.id,
          text: expect.any(String),
          createdAt: expect.anything(),
        }),
      }),
    );
    await eventually(async () => {
      expect(await harness.repos.message.get(privateMessage.id)).toEqual(expect.objectContaining({ pinned: true }));
    });

    const unpinEvent = waitForSocketEvent<any>(
      userBSocket,
      SocketEvent.MESSAGE_UNPINNED,
      (payload) => payload.message.id === privateMessage.id,
    );
    const unpinSystemMessage = waitForSocketEvent<any>(
      userBSocket,
      SocketEvent.RECEIVE_MESSAGE,
      (payload) =>
        payload.conversationId === privateSeed.conversation.id &&
        payload.message.type === MessageType.SYSTEM &&
        payload.message.senderId === privateSeed.userB.id,
    );
    const unpinAck = await emitWithAck<any>(userBSocket, SocketEvent.UNPIN_MESSAGE, {
      messageId: privateMessage.id,
    });
    expect(unpinAck.success).toBe(true);
    expect(unpinAck.message).toEqual(expect.objectContaining({ id: privateMessage.id, pinned: false }));
    expect(unpinAck.message.pinnedAt).toBeUndefined();
    await expect(unpinEvent).resolves.toEqual(
      expect.objectContaining({ message: expect.objectContaining({ id: privateMessage.id, pinned: false }) }),
    );
    const unpinSystemPayload = await unpinSystemMessage;
    expect(unpinSystemPayload).toEqual(
      expect.objectContaining({
        conversationId: privateSeed.conversation.id,
        message: expect.objectContaining({
          id: expect.any(String),
          type: MessageType.SYSTEM,
          senderId: privateSeed.userB.id,
          text: expect.any(String),
          createdAt: expect.anything(),
        }),
      }),
    );

    await eventually(async () => {
      const stored = await harness.repos.message.get(privateMessage.id);
      expect(stored).toEqual(expect.objectContaining({ pinned: false }));
      expect(stored?.pinnedAt).toBeNull();

      const loaded = await harness.api.get(
        `/v1/conversations/${privateSeed.conversation.id}/messages`,
        privateSeed.userA.id,
      );
      expect(loaded.status).toBe(200);
      const reloadedPrivateMessage = loaded.data.data.messages.find(
        (message: any) => message.id === privateMessage.id,
      );
      expect(reloadedPrivateMessage).toEqual(
        expect.objectContaining({ id: privateMessage.id, pinned: false }),
      );
      expect(reloadedPrivateMessage.pinnedAt).toBeNull();
      const loadedMessageIds = loaded.data.data.messages.map((message: any) => message.id);
      expect(loadedMessageIds.filter((id: string) => id === pinSystemPayload.message.id)).toHaveLength(1);
      expect(loadedMessageIds.filter((id: string) => id === unpinSystemPayload.message.id)).toHaveLength(1);

      const pinnedMessages = await harness.api.get(
        `/v1/conversations/${privateSeed.conversation.id}/pinned-messages`,
        privateSeed.userA.id,
      );
      expect(pinnedMessages.status).toBe(200);
      expect(pinnedMessages.data.data.map((message: any) => message.id)).not.toContain(privateMessage.id);
    });

    const { owner, member, conversation } = await seedGroupConversation(harness);
    const groupMessage = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: member.id,
      text: "member cannot pin",
    });
    const ownerMessage = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: owner.id,
      text: "owner can pin",
    });

    const memberPin = await harness.api.post(`/v1/messages/${groupMessage.id}/pin`, {}, member.id);
    expect(memberPin.status).toBe(403);
    expect(await harness.repos.message.get(groupMessage.id)).toEqual(expect.objectContaining({ pinned: false }));

    const ownerPin = await harness.api.post(`/v1/messages/${ownerMessage.id}/pin`, {}, owner.id);
    expect(ownerPin.status).toBe(200);
    expect(ownerPin.data.data).toEqual(expect.objectContaining({ id: ownerMessage.id, pinned: true }));
  });

  it("clears conversation pin state after socket unpin and REST reload", async () => {
    const privateSeed = await seedPrivateConversation(harness);
    const userSocket = await harness.connectMessagesSocket(privateSeed.userA.id);

    const pinAck = await emitWithAck<any>(userSocket, SocketEvent.PIN_CONVERSATION, {
      conversationId: privateSeed.conversation.id,
    });
    expect(pinAck.success).toBe(true);

    await eventually(async () => {
      const member = await harness.repos.member.findByCond({
        conversationId: privateSeed.conversation.id,
        userId: privateSeed.userA.id,
      });
      expect(member).toEqual(expect.objectContaining({ pinned: true, pinnedAt: expect.any(Date) }));
    });

    const unpinAck = await emitWithAck<any>(userSocket, SocketEvent.UNPIN_CONVERSATION, {
      conversationId: privateSeed.conversation.id,
    });
    expect(unpinAck.success).toBe(true);

    await eventually(async () => {
      const member = await harness.repos.member.findByCond({
        conversationId: privateSeed.conversation.id,
        userId: privateSeed.userA.id,
      });
      expect(member).toEqual(expect.objectContaining({ pinned: false }));
      expect(member?.pinnedAt).toBeNull();

      const cursor = await harness.api.get("/v1/conversations/cursor?limit=20", privateSeed.userA.id);
      expect(cursor.status).toBe(200);
      expect((cursor.data.pinned || []).map((conversation: any) => conversation.id)).not.toContain(
        privateSeed.conversation.id,
      );

      const reloadedConversation = (cursor.data.data || []).find(
        (conversation: any) => conversation.id === privateSeed.conversation.id,
      );
      expect(reloadedConversation).toEqual(
        expect.objectContaining({
          id: privateSeed.conversation.id,
          pinned: false,
          isPinned: false,
        }),
      );
      expect(reloadedConversation.pinnedAt).toBeUndefined();
    });
  });
});
