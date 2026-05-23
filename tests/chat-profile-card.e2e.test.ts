import { SocketEvent } from "@modules/chat/constants/socket-events";
import { MessageType } from "@modules/chat/model";
import {
  authHeader,
  ChatE2EHarness,
  createChatE2EHarness,
  seedGroupConversation,
  waitForSocketEvent,
} from "./helpers/chat-e2e-harness";

describe("profile card messages E2E", () => {
  let harness: ChatE2EHarness;

  beforeEach(async () => {
    harness = await createChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("sends a profile card message and emits enriched profile data to visible members", async () => {
    const { owner, member, conversation } = seedGroupConversation(harness.store);
    const profileUser = harness.store.addUser({
      displayName: "Shared Profile",
      username: "shared",
      avatarUrl: "https://cdn.test/shared.png",
    });
    const memberSocket = await harness.connectMessagesSocket(member.id);
    const received = waitForSocketEvent<any>(memberSocket, SocketEvent.RECEIVE_MESSAGE);

    const response = await harness.api.post(
      `/v2/conversations/${conversation.id}/profile-cards`,
      { userId: profileUser.id },
      { headers: authHeader(owner.id) },
    );

    expect(response.status).toBe(201);
    expect(response.data.data).toEqual(
      expect.objectContaining({
        type: MessageType.PROFILE_CARD,
        profileCardUserId: profileUser.id,
        profileCard: expect.objectContaining({
          id: profileUser.id,
          displayName: "Shared Profile",
          avatarUrl: "https://cdn.test/shared.png",
        }),
      }),
    );
    expect(harness.store.conversations.get(conversation.id)?.lastMessage).toEqual(
      expect.objectContaining({
        type: MessageType.PROFILE_CARD,
        textPreview: "Profile card",
      }),
    );
    await expect(received).resolves.toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        message: expect.objectContaining({
          type: MessageType.PROFILE_CARD,
          profileCard: expect.objectContaining({ id: profileUser.id }),
        }),
      }),
    );
  });

  it("blocks profile cards hidden by a block relationship", async () => {
    const { owner, conversation } = seedGroupConversation(harness.store);
    const profileUser = harness.store.addUser({ displayName: "Blocked Profile" });
    harness.store.blocks.add(`${profileUser.id}#${owner.id}`);

    const response = await harness.api.post(
      `/v2/conversations/${conversation.id}/profile-cards`,
      { userId: profileUser.id },
      { headers: authHeader(owner.id) },
    );

    expect(response.status).toBe(403);
    expect(Array.from(harness.store.messages.values()).map((message) => message.profileCardUserId)).not.toContain(
      profileUser.id,
    );
  });
});
