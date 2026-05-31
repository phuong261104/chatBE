import {
  authHeader,
  ChatE2EHarness,
  createChatE2EHarness,
  seedPrivateConversation,
} from "./helpers/chat-e2e-harness";

function conversationIds(response: any): string[] {
  return response.data.data.map((conversation: any) => conversation.id);
}

describe("hidden conversations E2E", () => {
  let harness: ChatE2EHarness;

  beforeEach(async () => {
    harness = await createChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("hides conversations from /v1 lists until unlocked or unhidden with the PIN", async () => {
    const { userA, conversation } = seedPrivateConversation(harness.store);

    const beforeHide = await harness.api.get("/v1/conversations", {
      headers: authHeader(userA.id),
    });
    expect(beforeHide.status).toBe(200);
    expect(conversationIds(beforeHide)).toContain(conversation.id);

    const hidden = await harness.api.post(
      `/v1/conversations/${conversation.id}/hide`,
      { pin: "1234" },
      { headers: authHeader(userA.id) },
    );
    expect(hidden.status).toBe(200);
    expect(harness.store.getMember(conversation.id, userA.id)?.hidden).toBe(true);

    const afterHide = await harness.api.get("/v1/conversations", {
      headers: authHeader(userA.id),
    });
    expect(afterHide.status).toBe(200);
    expect(conversationIds(afterHide)).not.toContain(conversation.id);

    const badUnlock = await harness.api.post(
      `/v1/conversations/${conversation.id}/unlock`,
      { pin: "9999" },
      { headers: authHeader(userA.id) },
    );
    expect(badUnlock.status).toBe(403);

    const unlocked = await harness.api.post(
      `/v1/conversations/${conversation.id}/unlock`,
      { pin: "1234" },
      { headers: authHeader(userA.id) },
    );
    expect(unlocked.status).toBe(200);
    expect(unlocked.data.data.conversation.id).toBe(conversation.id);

    const unhidden = await harness.api.post(
      `/v1/conversations/${conversation.id}/unhide`,
      { pin: "1234" },
      { headers: authHeader(userA.id) },
    );
    expect(unhidden.status).toBe(200);
    expect(harness.store.getMember(conversation.id, userA.id)?.hidden).toBe(false);

    const afterUnhide = await harness.api.get("/v1/conversations", {
      headers: authHeader(userA.id),
    });
    expect(conversationIds(afterUnhide)).toContain(conversation.id);
  });

  it("does not expose the removed /v2 REST prefix", async () => {
    const { userA } = seedPrivateConversation(harness.store);

    const response = await harness.api.get("/v2/conversations", {
      headers: authHeader(userA.id),
    });

    expect(response.status).toBe(404);
  });

  it("deletes a conversation for me and loads only messages after it becomes active again", async () => {
    const { userA, userB, conversation } = seedPrivateConversation(harness.store);

    const oldMessageResponse = await harness.api.post(
      `/v1/conversations/${conversation.id}/messages`,
      { text: "old delete-for-me message" },
      { headers: authHeader(userB.id) },
    );
    expect(oldMessageResponse.status).toBe(201);
    const oldMessageIds = oldMessageResponse.data.data.map((message: any) => message.id);

    const deleted = await harness.api.delete(
      `/v1/conversations/${conversation.id}`,
      { headers: authHeader(userA.id) },
    );
    expect(deleted.status).toBe(200);
    expect(deleted.data.data).toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        deletedAt: expect.any(String),
      }),
    );

    const afterDelete = await harness.api.get("/v1/conversations", {
      headers: authHeader(userA.id),
    });
    expect(afterDelete.status).toBe(200);
    expect(conversationIds(afterDelete)).not.toContain(conversation.id);

    const newMessageResponse = await harness.api.post(
      `/v1/conversations/${conversation.id}/messages`,
      { text: "new delete-for-me message" },
      { headers: authHeader(userB.id) },
    );
    expect(newMessageResponse.status).toBe(201);
    const newMessageIds = newMessageResponse.data.data.map((message: any) => message.id);

    const afterNewMessage = await harness.api.get("/v1/conversations", {
      headers: authHeader(userA.id),
    });
    expect(afterNewMessage.status).toBe(200);
    expect(conversationIds(afterNewMessage)).toContain(conversation.id);

    const loaded = await harness.api.get(`/v1/conversations/${conversation.id}/messages`, {
      headers: authHeader(userA.id),
    });
    expect(loaded.status).toBe(200);
    const loadedIds = loaded.data.data.messages.map((message: any) => message.id);
    expect(loadedIds).toEqual(expect.arrayContaining(newMessageIds));
    expect(loadedIds).toEqual(expect.not.arrayContaining(oldMessageIds));
  });
});
