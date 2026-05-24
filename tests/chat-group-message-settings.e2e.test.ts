import { SocketEvent } from "@modules/chat/constants/socket-events";
import { MessageType } from "@modules/chat/model";
import {
  authHeader,
  ChatE2EHarness,
  createChatE2EHarness,
  emitWithAck,
  seedGroupConversation,
  waitForSocketEvent,
} from "./helpers/chat-e2e-harness";

describe("group message settings E2E", () => {
  let harness: ChatE2EHarness;

  beforeEach(async () => {
    harness = await createChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("blocks regular members from sending when group messages are admin-only", async () => {
    const { owner, admin, member, conversation } = seedGroupConversation(harness.store);
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const adminSocket = await harness.connectMessagesSocket(admin.id);

    const settingsResponse = await harness.api.patch(
      `/v1/groups/${conversation.id}/settings`,
      { whoCanSendMessages: "admins" },
      { headers: authHeader(owner.id) },
    );
    expect(settingsResponse.status).toBe(200);

    const memberResponse = await harness.api.post(
      `/v1/conversations/${conversation.id}/messages`,
      { text: "member should be blocked" },
      { headers: authHeader(member.id) },
    );
    expect(memberResponse.status).toBe(403);
    expect(harness.store.visibleMessages(conversation.id).map((message) => message.text)).not.toContain(
      "member should be blocked",
    );

    const received = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);
    const adminAck = await emitWithAck<any>(adminSocket, SocketEvent.SEND_MESSAGE, {
      conversationId: conversation.id,
      text: "admin can send",
    });
    expect(adminAck.success).toBe(true);
    expect(adminAck.messages[0]).toEqual(
      expect.objectContaining({
        senderId: admin.id,
        text: "admin can send",
        type: MessageType.TEXT,
      }),
    );
    await expect(received).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        message: expect.objectContaining({ text: "admin can send" }),
      }),
    );
  });

  it("blocks link messages when group settings disable sending links", async () => {
    const { owner, admin, member, conversation } = seedGroupConversation(harness.store);
    const memberSocket = await harness.connectMessagesSocket(member.id);

    const settingsResponse = await harness.api.patch(
      `/v1/groups/${conversation.id}/settings`,
      { allowSendLink: false },
      { headers: authHeader(owner.id) },
    );
    expect(settingsResponse.status).toBe(200);

    const blockedLink = await harness.api.post(
      `/v1/conversations/${conversation.id}/messages`,
      { text: "read https://blocked.test now" },
      { headers: authHeader(admin.id) },
    );
    expect(blockedLink.status).toBe(403);
    expect(harness.store.classifications).toHaveLength(0);

    const received = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);
    const allowedText = await harness.api.post(
      `/v1/conversations/${conversation.id}/messages`,
      { text: "plain text still works" },
      { headers: authHeader(admin.id) },
    );
    expect(allowedText.status).toBe(201);
    expect(allowedText.data.data[0]).toEqual(
      expect.objectContaining({
        text: "plain text still works",
        type: MessageType.TEXT,
      }),
    );
    await expect(received).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        message: expect.objectContaining({ text: "plain text still works" }),
      }),
    );
  });
});
