import { SocketEvent } from "@modules/chat/constants/socket-events";
import { MessageStatus, MessageType } from "@modules/chat/model";
import {
  authHeader,
  createChatE2EHarness,
  emitWithAck,
  seedGroupConversation,
  seedPrivateConversation,
  waitForSocketEvent,
  ChatE2EHarness,
} from "./helpers/chat-e2e-harness";

const TOMBSTONE_TEXT = "Tin nhắn đã được thu hồi";

async function loadMessageIds(harness: ChatE2EHarness, conversationId: string, userId: string) {
  const response = await harness.api.get(`/v1/conversations/${conversationId}/messages`, {
    headers: authHeader(userId),
  });
  expect(response.status).toBe(200);
  return response.data.data.messages.map((message: any) => message.id);
}

describe("advanced messaging E2E, canonical v1", () => {
  let harness: ChatE2EHarness;

  beforeEach(async () => {
    harness = await createChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("sends messages through HTTP /v1, emits receiveMessage, and hides expired TTL messages", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const received = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);

    const response = await harness.api.post(
      `/v1/conversations/${conversation.id}/messages`,
      { text: "temporary secret", ttlSeconds: 60 },
      { headers: authHeader(owner.id) },
    );

    expect(response.status).toBe(201);
    const [message] = response.data.data;
    expect(message.text).toBe("temporary secret");
    expect(message.expiresAt).toBeTruthy();
    expect(message.expireAtEpoch).toBeGreaterThan(Math.floor(Date.now() / 1000));

    await expect(received).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        message: expect.objectContaining({ id: message.id, text: "temporary secret" }),
      }),
    );

    expect(await loadMessageIds(harness, conversation.id, member.id)).toContain(message.id);
    harness.store.expireMessage(message.id);
    expect(await loadMessageIds(harness, conversation.id, member.id)).not.toContain(message.id);

    const searchResponse = await harness.api.get(
      `/v1/conversations/${conversation.id}/search?query=temporary`,
      { headers: authHeader(member.id) },
    );
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.data.data.messages).toHaveLength(0);
  });

  it("keeps socket sendMessage aligned with HTTP /v1 TTL behavior", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
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
  });

  it("edits through HTTP /v1 within 30 seconds and rejects stale edits on HTTP and socket", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const fresh = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "before",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 10_000),
    });
    const stale = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "too late",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 31_000),
    });
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const edited = waitForSocketEvent<any>(memberSocket, SocketEvent.MESSAGE_EDITED);

    const editResponse = await harness.api.put(
      `/v1/messages/${fresh.id}`,
      { text: "after" },
      { headers: authHeader(owner.id) },
    );
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
      { headers: authHeader(owner.id) },
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
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const first = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "one",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 2000),
    });
    const latest = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "two",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 1000),
    });
    const memberRecord = harness.store.getMember(conversation.id, member.id)!;
    memberRecord.unreadCount = 2;

    const deliveredResponse = await harness.api.post(
      `/v1/conversations/${conversation.id}/delivered`,
      { lastDeliveredMessageId: first.id },
      { headers: authHeader(member.id) },
    );
    expect(deliveredResponse.status).toBe(200);
    expect(harness.store.getMember(conversation.id, member.id)).toEqual(
      expect.objectContaining({ lastDeliveredMessageId: first.id }),
    );

    const seenResponse = await harness.api.post(
      `/v1/conversations/${conversation.id}/seen`,
      { lastSeenMessageId: latest.id },
      { headers: authHeader(member.id) },
    );
    expect(seenResponse.status).toBe(200);
    expect(harness.store.getMember(conversation.id, member.id)).toEqual(
      expect.objectContaining({
        lastSeenMessageId: latest.id,
        lastReadMessageId: latest.id,
        unreadCount: 0,
      }),
    );

    const socketLatest = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "three",
      type: MessageType.TEXT,
      createdAt: new Date(),
    });
    const ownerSocket = await harness.connectMessagesSocket(owner.id);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const deliveredEvent = waitForSocketEvent<any>(ownerSocket, SocketEvent.MESSAGE_DELIVERED);
    const seenEvent = waitForSocketEvent<any>(ownerSocket, SocketEvent.MESSAGE_SEEN);

    const deliveredAck = await emitWithAck<any>(memberSocket, SocketEvent.MESSAGE_DELIVERED, {
      conversationId: conversation.id,
      lastDeliveredMessageId: socketLatest.id,
    });
    const seenAck = await emitWithAck<any>(memberSocket, SocketEvent.MESSAGE_SEEN, {
      conversationId: conversation.id,
      lastSeenMessageId: socketLatest.id,
    });

    expect(deliveredAck.success).toBe(true);
    expect(deliveredAck.changed).toBe(true);
    expect(seenAck.success).toBe(true);
    expect(seenAck.changed).toBe(true);
    await expect(deliveredEvent).resolves.toEqual(
      expect.objectContaining({ conversationId: conversation.id, userId: member.id, lastDeliveredMessageId: socketLatest.id }),
    );
    await expect(seenEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        userId: member.id,
        lastSeenMessageId: socketLatest.id,
        lastReadMessageId: socketLatest.id,
        unreadCount: 0,
      }),
    );
  });

  it("fans out messages and read state to multiple tabs for the same user", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const ownerTabA = await harness.connectMessagesSocket(owner.id);
    const ownerTabB = await harness.connectMessagesSocket(owner.id);
    const memberTabA = await harness.connectMessagesSocket(member.id);
    const memberTabB = await harness.connectMessagesSocket(member.id);

    const memberTabAReceived = waitForSocketEvent<any>(memberTabA, SocketEvent.RECEIVE_MESSAGE);
    const memberTabBReceived = waitForSocketEvent<any>(memberTabB, SocketEvent.RECEIVE_MESSAGE);
    const firstAck = await emitWithAck<any>(ownerTabA, SocketEvent.SEND_MESSAGE, {
      conversationId: conversation.id,
      text: "fanout to member tabs",
    });

    expect(firstAck.success).toBe(true);
    await expect(memberTabAReceived).resolves.toEqual(
      expect.objectContaining({ message: expect.objectContaining({ id: firstAck.messages[0].id }) }),
    );
    await expect(memberTabBReceived).resolves.toEqual(
      expect.objectContaining({ message: expect.objectContaining({ id: firstAck.messages[0].id }) }),
    );

    const ownerTabBReceived = waitForSocketEvent<any>(ownerTabB, SocketEvent.RECEIVE_MESSAGE);
    const memberReceivedSecond = waitForSocketEvent<any>(memberTabA, SocketEvent.RECEIVE_MESSAGE);
    const secondAck = await emitWithAck<any>(ownerTabA, SocketEvent.SEND_MESSAGE, {
      conversationId: conversation.id,
      text: "sender sibling tab",
    });

    expect(secondAck.success).toBe(true);
    await expect(ownerTabBReceived).resolves.toEqual(
      expect.objectContaining({ message: expect.objectContaining({ id: secondAck.messages[0].id }) }),
    );
    await expect(memberReceivedSecond).resolves.toEqual(
      expect.objectContaining({ message: expect.objectContaining({ id: secondAck.messages[0].id }) }),
    );
    expect(
      harness.socketEvents.filter(
        (event) =>
          event.target === "user" &&
          event.targetId === member.id &&
          event.event === SocketEvent.RECEIVE_MESSAGE &&
          event.data.message.id === secondAck.messages[0].id,
      ),
    ).toHaveLength(1);
  });

  it("syncs actor tabs on seen and ignores stale seen markers", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const older = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "older",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 2000),
    });
    const latest = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "latest",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 1000),
    });
    const memberRecord = harness.store.getMember(conversation.id, member.id)!;
    memberRecord.unreadCount = 2;

    const ownerSocket = await harness.connectMessagesSocket(owner.id);
    const memberTabA = await harness.connectMessagesSocket(member.id);
    const memberTabB = await harness.connectMessagesSocket(member.id);
    const ownerSeen = waitForSocketEvent<any>(ownerSocket, SocketEvent.MESSAGE_SEEN);
    const actorTabSeen = waitForSocketEvent<any>(memberTabB, SocketEvent.MESSAGE_SEEN);

    const seenAck = await emitWithAck<any>(memberTabA, SocketEvent.MESSAGE_SEEN, {
      conversationId: conversation.id,
      lastSeenMessageId: latest.id,
    });

    expect(seenAck).toEqual(
      expect.objectContaining({
        success: true,
        changed: true,
        state: expect.objectContaining({
          conversationId: conversation.id,
          userId: member.id,
          lastSeenMessageId: latest.id,
          lastReadMessageId: latest.id,
          unreadCount: 0,
        }),
      }),
    );
    await expect(actorTabSeen).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        userId: member.id,
        lastSeenMessageId: latest.id,
        lastReadMessageId: latest.id,
        unreadCount: 0,
      }),
    );
    await expect(ownerSeen).resolves.toEqual(
      expect.objectContaining({ conversationId: conversation.id, userId: member.id, lastSeenMessageId: latest.id }),
    );

    const seenEventCount = harness.socketEvents.filter(
      (event) => event.event === SocketEvent.MESSAGE_SEEN && event.data.userId === member.id,
    ).length;
    const staleAck = await emitWithAck<any>(memberTabB, SocketEvent.MESSAGE_SEEN, {
      conversationId: conversation.id,
      lastSeenMessageId: older.id,
    });

    expect(staleAck.success).toBe(true);
    expect(staleAck.changed).toBe(false);
    expect(harness.store.getMember(conversation.id, member.id)).toEqual(
      expect.objectContaining({
        lastSeenMessageId: latest.id,
        lastReadMessageId: latest.id,
        unreadCount: 0,
      }),
    );
    expect(
      harness.socketEvents.filter(
        (event) => event.event === SocketEvent.MESSAGE_SEEN && event.data.userId === member.id,
      ),
    ).toHaveLength(seenEventCount);
  });

  it("keeps unread atomic for concurrent sends and idempotent for clientMessageId retries", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const ownerTabA = await harness.connectMessagesSocket(owner.id);
    const ownerTabB = await harness.connectMessagesSocket(owner.id);

    const [firstAck, secondAck] = await Promise.all([
      emitWithAck<any>(ownerTabA, SocketEvent.SEND_MESSAGE, {
        conversationId: conversation.id,
        text: "concurrent one",
      }),
      emitWithAck<any>(ownerTabB, SocketEvent.SEND_MESSAGE, {
        conversationId: conversation.id,
        text: "concurrent two",
      }),
    ]);

    expect(firstAck.success).toBe(true);
    expect(secondAck.success).toBe(true);
    expect(harness.store.getMember(conversation.id, member.id)?.unreadCount).toBe(2);

    const retryA = await emitWithAck<any>(ownerTabA, SocketEvent.SEND_MESSAGE, {
      conversationId: conversation.id,
      text: "idempotent",
      clientMessageId: "retry-1",
    });
    const retryB = await emitWithAck<any>(ownerTabB, SocketEvent.SEND_MESSAGE, {
      conversationId: conversation.id,
      text: "idempotent",
      clientMessageId: "retry-1",
    });

    expect(retryA.success).toBe(true);
    expect(retryB.success).toBe(true);
    expect(retryB.messages.map((message: any) => message.id)).toEqual(
      retryA.messages.map((message: any) => message.id),
    );
    expect(
      Array.from(harness.store.messages.values()).filter(
        (message) =>
          message.conversationId === conversation.id &&
          message.senderId === owner.id &&
          message.clientMessageId === "retry-1",
      ),
    ).toHaveLength(1);
    expect(harness.store.getMember(conversation.id, member.id)?.unreadCount).toBe(3);
  });

  it("recalls within 24 hours, rejects expired recall, and keeps delete-for-me local", async () => {
    const { userA: owner, userB: member, conversation } = seedPrivateConversation(harness.store);
    const recallable = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "remove everywhere",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 60_000),
    });
    const old = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "too old",
      type: MessageType.TEXT,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    const localOnly = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "only hidden for member",
      type: MessageType.TEXT,
      createdAt: new Date(),
    });
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const revokedEvent = waitForSocketEvent<any>(memberSocket, SocketEvent.MESSAGE_REVOKED);

    const revokeResponse = await harness.api.post(
      `/v1/messages/${recallable.id}/revoke`,
      {},
      { headers: authHeader(owner.id) },
    );
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

    const expiredRecall = await harness.api.post(
      `/v1/messages/${old.id}/revoke`,
      {},
      { headers: authHeader(owner.id) },
    );
    expect(expiredRecall.status).toBe(403);

    const deleteForMe = await harness.api.post(
      `/v1/messages/${localOnly.id}/delete`,
      {},
      { headers: authHeader(member.id) },
    );
    expect(deleteForMe.status).toBe(200);
    expect(await loadMessageIds(harness, conversation.id, member.id)).not.toContain(localOnly.id);
    expect(await loadMessageIds(harness, conversation.id, owner.id)).toContain(localOnly.id);
  });

  it("supports socket delete-for-everyone with the same tombstone semantics as recall", async () => {
    const { userA: owner, userB: member, conversation } = seedPrivateConversation(harness.store);
    const message = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "socket recall",
      type: MessageType.TEXT,
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
    expect(harness.store.getMessage(message.id)).toEqual(
      expect.objectContaining({
        text: TOMBSTONE_TEXT,
        messageStatus: MessageStatus.REVOKED,
        deletedBy: owner.id,
      }),
    );
    await expect(deletedForEveryoneEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        messageId: message.id,
        deletedBy: owner.id,
      }),
    );
  });

  it("quotes and forwards via HTTP fallback routes and matching socket events", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const target = harness.store.addConversation({
      type: conversation.type,
      name: "Target",
      createdBy: owner.id,
      ownerId: owner.id,
      admins: [owner.id],
      membersCount: 2,
    });
    harness.store.addMember({ conversationId: target.id, userId: owner.id, role: "admin" as any });
    harness.store.addMember({ conversationId: target.id, userId: member.id });
    const source = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: member.id,
      text: "source context",
      type: MessageType.TEXT,
    });

    const quoteResponse = await harness.api.post(
      `/v1/messages/${source.id}/quote`,
      { text: "http reply" },
      { headers: authHeader(owner.id) },
    );
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
      { headers: authHeader(owner.id) },
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

    const forwardedEvent = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);
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
    const { userA: owner, userB: member, conversation } = seedPrivateConversation(harness.store);
    const message = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: owner.id,
      text: "reactable",
      type: MessageType.TEXT,
    });

    const reactOwner = await harness.api.post(
      `/v1/messages/${message.id}/react`,
      { emoji: "like" },
      { headers: authHeader(owner.id) },
    );
    const reactMember = await harness.api.post(
      `/v1/messages/${message.id}/react`,
      { emoji: "like" },
      { headers: authHeader(member.id) },
    );
    expect(reactOwner.status).toBe(201);
    expect(reactMember.status).toBe(201);

    const summary = await harness.api.get(`/v1/messages/${message.id}/reactions`, {
      headers: authHeader(owner.id),
    });
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

    const updatedSummary = await harness.api.get(`/v1/messages/${message.id}/reactions`, {
      headers: authHeader(owner.id),
    });
    expect(updatedSummary.data.data.grouped).toEqual({ like: 1 });
  });

  it("allows private pinning by both users but rejects normal group members", async () => {
    const privateSeed = seedPrivateConversation(harness.store);
    const privateMessage = harness.store.addMessage({
      conversationId: privateSeed.conversation.id,
      senderId: privateSeed.userA.id,
      text: "pin in private",
      type: MessageType.TEXT,
    });

    const pinByA = await harness.api.post(
      `/v1/messages/${privateMessage.id}/pin`,
      {},
      { headers: authHeader(privateSeed.userA.id) },
    );
    expect(pinByA.status).toBe(200);
    expect(pinByA.data.data).toEqual(expect.objectContaining({ id: privateMessage.id, pinned: true }));
    expect(
      harness.socketEvents.some(
        (event) =>
          event.event === SocketEvent.RECEIVE_MESSAGE &&
          event.targetId === privateSeed.userA.id &&
          event.data.conversationId === privateSeed.conversation.id &&
          event.data.message.type === MessageType.SYSTEM &&
          event.data.message.senderId === privateSeed.userA.id,
      ),
    ).toBe(true);

    const unpinByB = await harness.api.delete(`/v1/messages/${privateMessage.id}/pin`, {
      headers: authHeader(privateSeed.userB.id),
    });
    expect(unpinByB.status).toBe(200);
    expect(unpinByB.data.data).toEqual(
      expect.objectContaining({ id: privateMessage.id, pinned: false }),
    );
    expect(unpinByB.data.data.pinnedAt).toBeUndefined();
    expect(
      harness.socketEvents.some(
        (event) =>
          event.event === SocketEvent.RECEIVE_MESSAGE &&
          event.targetId === privateSeed.userB.id &&
          event.data.conversationId === privateSeed.conversation.id &&
          event.data.message.type === MessageType.SYSTEM &&
          event.data.message.senderId === privateSeed.userB.id,
      ),
    ).toBe(true);

    const userBSocket = await harness.connectMessagesSocket(privateSeed.userB.id);
    const pinEvent = waitForSocketEvent<any>(userBSocket, SocketEvent.MESSAGE_PINNED);
    const pinSystemMessage = waitForSocketEvent<any>(userBSocket, SocketEvent.RECEIVE_MESSAGE);
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
    expect(harness.store.getMessage(privateMessage.id)).toEqual(expect.objectContaining({ pinned: true }));

    const unpinEvent = waitForSocketEvent<any>(userBSocket, SocketEvent.MESSAGE_UNPINNED);
    const unpinSystemMessage = waitForSocketEvent<any>(userBSocket, SocketEvent.RECEIVE_MESSAGE);
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
    expect(harness.store.getMessage(privateMessage.id)).toEqual(
      expect.objectContaining({ pinned: false, pinnedAt: undefined }),
    );

    const reloadedMessages = await harness.api.get(
      `/v1/conversations/${privateSeed.conversation.id}/messages`,
      { headers: authHeader(privateSeed.userA.id) },
    );
    expect(reloadedMessages.status).toBe(200);
    const reloadedPrivateMessage = reloadedMessages.data.data.messages.find(
      (message: any) => message.id === privateMessage.id,
    );
    expect(reloadedPrivateMessage).toEqual(
      expect.objectContaining({ id: privateMessage.id, pinned: false }),
    );
    expect(reloadedPrivateMessage.pinnedAt).toBeUndefined();
    const reloadedMessageIds = reloadedMessages.data.data.messages.map((message: any) => message.id);
    expect(reloadedMessageIds.filter((id: string) => id === pinSystemPayload.message.id)).toHaveLength(1);
    expect(reloadedMessageIds.filter((id: string) => id === unpinSystemPayload.message.id)).toHaveLength(1);

    const pinnedMessages = await harness.api.get(
      `/v1/conversations/${privateSeed.conversation.id}/pinned-messages`,
      { headers: authHeader(privateSeed.userA.id) },
    );
    expect(pinnedMessages.status).toBe(200);
    expect(pinnedMessages.data.data.map((message: any) => message.id)).not.toContain(privateMessage.id);

    const { member, conversation } = seedGroupConversation(harness.store);
    const groupMessage = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: member.id,
      text: "member cannot pin",
      type: MessageType.TEXT,
    });

    const memberPin = await harness.api.post(
      `/v1/messages/${groupMessage.id}/pin`,
      {},
      { headers: authHeader(member.id) },
    );
    expect(memberPin.status).toBe(403);
    expect(harness.store.getMessage(groupMessage.id)).toEqual(expect.objectContaining({ pinned: false }));
  });

  it("rejects pinning more than five messages in one conversation", async () => {
    const { userA, conversation } = seedPrivateConversation(harness.store);
    const messages = Array.from({ length: 6 }, (_, index) =>
      harness.store.addMessage({
        conversationId: conversation.id,
        senderId: userA.id,
        text: `pin limit ${index + 1}`,
        type: MessageType.TEXT,
      }),
    );

    for (const message of messages.slice(0, 5)) {
      const response = await harness.api.post(
        `/v1/messages/${message.id}/pin`,
        {},
        { headers: authHeader(userA.id) },
      );
      expect(response.status).toBe(200);
      expect(harness.store.getMessage(message.id)).toEqual(expect.objectContaining({ pinned: true }));
    }

    const overflow = await harness.api.post(
      `/v1/messages/${messages[5].id}/pin`,
      {},
      { headers: authHeader(userA.id) },
    );

    expect(overflow.status).toBe(400);
    expect(harness.store.getMessage(messages[5].id)).toEqual(expect.objectContaining({ pinned: false }));
    expect(
      Array.from(harness.store.messages.values()).filter(
        (message) => message.conversationId === conversation.id && message.pinned,
      ),
    ).toHaveLength(5);
  });
});
