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

  it("hides conversations from v2 lists until unlocked or unhidden with the PIN", async () => {
    const { userA, conversation } = seedPrivateConversation(harness.store);

    const beforeHide = await harness.api.get("/v2/conversations", {
      headers: authHeader(userA.id),
    });
    expect(beforeHide.status).toBe(200);
    expect(conversationIds(beforeHide)).toContain(conversation.id);

    const hidden = await harness.api.post(
      `/v2/conversations/${conversation.id}/hide`,
      { pin: "1234" },
      { headers: authHeader(userA.id) },
    );
    expect(hidden.status).toBe(200);
    expect(harness.store.getMember(conversation.id, userA.id)?.hidden).toBe(true);

    const afterHide = await harness.api.get("/v2/conversations", {
      headers: authHeader(userA.id),
    });
    expect(afterHide.status).toBe(200);
    expect(conversationIds(afterHide)).not.toContain(conversation.id);

    const badUnlock = await harness.api.post(
      `/v2/conversations/${conversation.id}/unlock`,
      { pin: "9999" },
      { headers: authHeader(userA.id) },
    );
    expect(badUnlock.status).toBe(403);

    const unlocked = await harness.api.post(
      `/v2/conversations/${conversation.id}/unlock`,
      { pin: "1234" },
      { headers: authHeader(userA.id) },
    );
    expect(unlocked.status).toBe(200);
    expect(unlocked.data.data.conversation.id).toBe(conversation.id);

    const unhidden = await harness.api.post(
      `/v2/conversations/${conversation.id}/unhide`,
      { pin: "1234" },
      { headers: authHeader(userA.id) },
    );
    expect(unhidden.status).toBe(200);
    expect(harness.store.getMember(conversation.id, userA.id)?.hidden).toBe(false);

    const afterUnhide = await harness.api.get("/v2/conversations", {
      headers: authHeader(userA.id),
    });
    expect(conversationIds(afterUnhide)).toContain(conversation.id);
  });
});
