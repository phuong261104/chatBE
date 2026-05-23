import { ConversationMemberStatus } from "@modules/chat/model";
import {
  authHeader,
  ChatE2EHarness,
  createChatE2EHarness,
  waitForSocketEvent,
} from "./helpers/chat-e2e-harness";

describe("private message requests E2E", () => {
  let harness: ChatE2EHarness;

  beforeEach(async () => {
    harness = await createChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("creates a pending message request for non-friends and keeps it accepted after approval", async () => {
    const sender = harness.store.addUser({ displayName: "Sender" });
    const receiver = harness.store.addUser({ displayName: "Receiver" });
    const receiverSocket = await harness.connectMessagesSocket(receiver.id);
    const incoming = waitForSocketEvent<any>(receiverSocket, "message-request:incoming");

    const firstMessage = await harness.api.post(
      "/v2/messages/private",
      { targetUserId: receiver.id, text: "hello stranger" },
      { headers: authHeader(sender.id) },
    );

    expect(firstMessage.status).toBe(201);
    expect(firstMessage.data.data.messageRequestStatus).toBe("pending");
    expect(firstMessage.data.data.messages[0].text).toBe("hello stranger");
    await expect(incoming).resolves.toEqual(
      expect.objectContaining({
        fromUserId: sender.id,
        message: expect.objectContaining({ text: "hello stranger" }),
      }),
    );

    const conversationId = firstMessage.data.data.conversation.id;
    expect(harness.store.getMember(conversationId, receiver.id)?.status).toBe(ConversationMemberStatus.PENDING);

    const requests = await harness.api.get("/v2/message-requests", {
      headers: authHeader(receiver.id),
    });
    expect(requests.status).toBe(200);
    expect(requests.data.data.map((request: any) => request.conversation.id)).toContain(conversationId);

    const accepted = await harness.api.post(
      `/v2/message-requests/${conversationId}/accept`,
      {},
      { headers: authHeader(receiver.id) },
    );
    expect(accepted.status).toBe(200);
    expect(harness.store.getMember(conversationId, receiver.id)?.status).toBe(ConversationMemberStatus.ACTIVE);

    const secondMessage = await harness.api.post(
      "/v2/messages/private",
      { targetUserId: receiver.id, text: "after accept" },
      { headers: authHeader(sender.id) },
    );
    expect(secondMessage.status).toBe(201);
    expect(secondMessage.data.data.messageRequestStatus).toBe("accepted");
    expect(harness.store.getMember(conversationId, receiver.id)?.status).toBe(ConversationMemberStatus.ACTIVE);
  });

  it("rejects private messages when either user has blocked the other", async () => {
    const sender = harness.store.addUser({ displayName: "Sender" });
    const receiver = harness.store.addUser({ displayName: "Receiver" });
    harness.store.blocks.add(`${receiver.id}#${sender.id}`);

    const response = await harness.api.post(
      "/v2/messages/private",
      { targetUserId: receiver.id, text: "blocked" },
      { headers: authHeader(sender.id) },
    );

    expect(response.status).toBe(403);
    expect(Array.from(harness.store.messages.values()).map((message) => message.text)).not.toContain("blocked");
  });
});
