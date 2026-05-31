import { SocketEvent } from "@modules/chat/constants/socket-events";
import { ConversationMemberRole, ConversationType, MessageType } from "@modules/chat/model";
import { FriendRequestStatus } from "@modules/friend-requests/model";
import { UserGender, UserInfoVisibility } from "@modules/user/model/model";
import {
  createLiveChatE2EHarness,
  eventually,
  LiveChatE2EHarness,
  seedConversation,
  seedFriendship,
  seedMember,
  seedMessage,
  seedUser,
  waitForSocketEvent,
} from "./helpers/chat-live-e2e-harness";

const liveDescribe =
  process.env.RUN_LIVE_INFRA_E2E === "true" || process.env.RUN_LIVE_SOCIAL_E2E === "true"
    ? describe
    : describe.skip;

async function trackAcceptedFriendConversation(
  harness: LiveChatE2EHarness,
  userA: string,
  userB: string,
) {
  const pairKey = [userA, userB].sort().join("_");
  await eventually(async () => {
    const conversation = await harness.repos.conversation.findByPairKey(pairKey, ConversationType.PRIVATE);
    expect(conversation?.id).toBeTruthy();
    harness.trackConversation(conversation!.id);
  });
}

liveDescribe("social, privacy, profile live E2E with real DynamoDB repositories", () => {
  let harness: LiveChatE2EHarness;

  jest.setTimeout(90_000);

  beforeEach(async () => {
    harness = await createLiveChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("persists friend request lifecycle and friend suggestions using real DB indexes", async () => {
    const alice = await seedUser(harness, "Live Alice");
    const bob = await seedUser(harness, "Live Bob");
    const mutual = await seedUser(harness, "Live Mutual");
    const sharedOnly = await seedUser(harness, "Live Shared Group");

    const bobFriendsSocket = await harness.connectFriendsSocket(bob.id);
    const received = waitForSocketEvent<any>(bobFriendsSocket, "friend_request:received");
    const send = await harness.api.post(`/v1/friend-requests/${bob.id}`, {}, alice.id);
    expect(send.status).toBe(201);
    expect(send.data.data.status).toBe(FriendRequestStatus.PENDING);
    harness.trackFriendRequest(send.data.data.id);
    await expect(received).resolves.toEqual(expect.objectContaining({ type: "FRIEND_REQUEST_RECEIVED" }));

    const aliceFriendsSocket = await harness.connectFriendsSocket(alice.id);
    const accepted = waitForSocketEvent<any>(aliceFriendsSocket, "friend_request:accepted");
    const accept = await harness.api.patch(
      `/v1/friend-requests/${send.data.data.id}`,
      { status: FriendRequestStatus.ACCEPTED },
      bob.id,
    );
    expect(accept.status).toBe(200);
    harness.trackFriendship(alice.id, bob.id);
    await trackAcceptedFriendConversation(harness, alice.id, bob.id);
    await expect(accepted).resolves.toEqual(expect.objectContaining({ type: "FRIEND_REQUEST_ACCEPTED" }));

    const rejectedReq = await harness.api.post(`/v1/friend-requests/${mutual.id}`, {}, alice.id);
    expect(rejectedReq.status).toBe(201);
    harness.trackFriendRequest(rejectedReq.data.data.id);
    const reject = await harness.api.patch(
      `/v1/friend-requests/${rejectedReq.data.data.id}`,
      { status: FriendRequestStatus.REJECTED },
      mutual.id,
    );
    expect(reject.status).toBe(200);

    const canceledReq = await harness.api.post(`/v1/friend-requests/${sharedOnly.id}`, {}, alice.id);
    expect(canceledReq.status).toBe(201);
    harness.trackFriendRequest(canceledReq.data.data.id);
    const cancel = await harness.api.delete(`/v1/friend-requests/${canceledReq.data.data.id}`, alice.id);
    expect(cancel.status).toBe(204);

    await eventually(async () => {
      expect((await harness.repos.friendRequest.get(rejectedReq.data.data.id))?.status).toBe(
        FriendRequestStatus.REJECTED,
      );
      expect((await harness.repos.friendRequest.get(canceledReq.data.data.id))?.status).toBe(
        FriendRequestStatus.CANCELED,
      );
    });

    await seedFriendship(harness, bob.id, mutual.id);
    const group = await seedConversation(harness, {
      type: ConversationType.GROUP,
      name: "Live Suggestion Group",
      createdBy: alice.id,
      ownerId: alice.id,
      membersCount: 2,
    });
    await seedMember(harness, {
      conversationId: group.id,
      userId: alice.id,
      role: ConversationMemberRole.OWNER,
    });
    await seedMember(harness, { conversationId: group.id, userId: sharedOnly.id });

    await eventually(async () => {
      const suggestions = await harness.api.get("/v1/friends/suggestions", alice.id);
      expect(suggestions.status).toBe(200);
      expect(suggestions.data.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: mutual.id, reasons: expect.arrayContaining(["mutual_friends"]) }),
          expect.objectContaining({ id: sharedOnly.id, reasons: expect.arrayContaining(["shared_groups"]) }),
        ]),
      );
    });
  });

  it("enforces block, stranger policy, profile privacy, avatar history, and profile card realtime with real DB", async () => {
    const blocker = await seedUser(harness, "Live Blocker");
    const blocked = await seedUser(harness, "Live Blocked");
    const stranger = await seedUser(harness, "Live Stranger");
    const contact = await seedUser(harness, "Live Contact", {
      avatarUrl: "https://cdn.test/live-contact-old.png",
      birthday: new Date("2000-01-01T00:00:00.000Z"),
      gender: UserGender.OTHER,
      bio: "hello",
    });

    await seedFriendship(harness, blocker.id, blocked.id);
    const existing = await seedConversation(harness, {
      type: ConversationType.PRIVATE,
      pairKey: [blocker.id, blocked.id].sort().join("_"),
      membersCount: 2,
    });
    await seedMember(harness, { conversationId: existing.id, userId: blocker.id });
    await seedMember(harness, { conversationId: existing.id, userId: blocked.id });
    const oldMessage = await seedMessage(harness, {
      conversationId: existing.id,
      senderId: blocked.id,
      text: "old history remains",
      type: MessageType.TEXT,
    });

    const block = await harness.api.post(`/v1/blocks/${blocked.id}`, {}, blocker.id);
    expect(block.status).toBe(200);
    harness.trackBlock(blocker.id, blocked.id);

    const blockedMessage = await harness.api.post(
      "/v1/messages/private",
      { targetUserId: blocker.id, text: "can I send?" },
      blocked.id,
    );
    expect(blockedMessage.status).toBe(403);

    const hiddenProfile = await harness.api.get(`/v1/users/${blocker.id}/public`, blocked.id);
    expect(hiddenProfile.status).toBe(403);
    const hiddenPresence = await harness.api.get(`/v1/users/${blocker.id}/presence`, blocked.id);
    expect(hiddenPresence.status).toBe(200);
    expect(hiddenPresence.data.data).toEqual(expect.objectContaining({ visibility: "hidden", isOnline: false }));

    await eventually(async () => {
      const history = await harness.api.get(`/v1/conversations/${existing.id}/messages`, blocker.id);
      expect(history.status).toBe(200);
      expect(history.data.data.messages).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: oldMessage.id })]),
      );
    });

    const privacy = await harness.api.patch(
      "/v1/users/me/privacy",
      {
        blockMessagesFromStrangers: true,
        phoneVisibility: UserInfoVisibility.ONLY_ME,
        birthdayVisibility: UserInfoVisibility.ONLY_ME,
        avatarVisibility: UserInfoVisibility.ONLY_ME,
        searchableByPhone: false,
        showOnline: false,
        showLastSeen: false,
      },
      contact.id,
    );
    expect(privacy.status).toBe(200);

    const strangerBlocked = await harness.api.post(
      "/v1/messages/private",
      { targetUserId: contact.id, text: "hello from stranger" },
      stranger.id,
    );
    expect(strangerBlocked.status).toBe(403);

    const searchHidden = await harness.api.get(
      `/v1/users/search-by-phone?phone=${encodeURIComponent(contact.phone || "")}`,
      stranger.id,
    );
    expect(searchHidden.status).toBe(404);

    const publicProfile = await harness.api.get(`/v1/users/${contact.id}/public`, stranger.id);
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.data.data.phone).toBeUndefined();
    expect(publicProfile.data.data.birthday).toBeUndefined();
    expect(publicProfile.data.data.avatarUrl).toBeUndefined();

    const updateProfile = await harness.api.patch(
      "/v1/users/me/profile",
      { avatarUrl: "https://cdn.test/live-contact-new.png", coverUrl: "https://cdn.test/live-cover.png", bio: "updated" },
      contact.id,
    );
    expect(updateProfile.status).toBe(200);

    await eventually(async () => {
      const avatarHistory = await harness.api.get("/v1/users/me/avatar-history", contact.id);
      expect(avatarHistory.status).toBe(200);
      expect(avatarHistory.data.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: contact.id, avatarUrl: "https://cdn.test/live-contact-old.png" }),
        ]),
      );
    });

    const sender = await seedUser(harness, "Live Sender");
    const receiver = await seedUser(harness, "Live Receiver");
    const receiverSocket = await harness.connectMessagesSocket(receiver.id);
    const messageRequestEvent = waitForSocketEvent<any>(receiverSocket, "message-request:incoming");
    const requestMessage = await harness.api.post(
      "/v1/messages/private",
      { targetUserId: receiver.id, text: "message request" },
      sender.id,
    );
    expect(requestMessage.status).toBe(201);
    expect(requestMessage.data.data.messageRequestStatus).toBe("pending");
    harness.trackConversation(requestMessage.data.data.conversation.id);
    await expect(messageRequestEvent).resolves.toEqual(expect.objectContaining({ fromUserId: sender.id }));

    await eventually(async () => {
      const strangers = await harness.api.get("/v1/conversations/strangers", receiver.id);
      expect(strangers.status).toBe(200);
      expect(strangers.data.data).toEqual([
        expect.objectContaining({ messageRequestStatus: "pending" }),
      ]);
    });

    const senderSocket = await harness.connectMessagesSocket(sender.id);
    const profileCardEvent = waitForSocketEvent<any>(
      senderSocket,
      SocketEvent.RECEIVE_MESSAGE,
      (payload) =>
        payload.conversationId === requestMessage.data.data.conversation.id &&
        payload.message?.type === MessageType.PROFILE_CARD,
    );
    const profileCard = await harness.api.post(
      `/v1/conversations/${requestMessage.data.data.conversation.id}/profile-cards`,
      { userId: contact.id },
      receiver.id,
    );
    expect(profileCard.status).toBe(201);
    expect(profileCard.data.data).toEqual(
      expect.objectContaining({ type: MessageType.PROFILE_CARD, profileCardUserId: contact.id }),
    );
    await expect(profileCardEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId: requestMessage.data.data.conversation.id,
        message: expect.objectContaining({
          type: MessageType.PROFILE_CARD,
          profileCard: expect.objectContaining({ id: contact.id }),
        }),
      }),
    );
  });

  it("returns enriched public profiles and enriched block lists from real DB", async () => {
    const viewer = await seedUser(harness, "Live Enrich Viewer");
    const friend = await seedUser(harness, "Live Enrich Friend", {
      email: "live-enrich-friend@example.test",
      avatarUrl: "https://cdn.test/live-enrich-friend-avatar.png",
      coverUrl: "https://cdn.test/live-enrich-friend-cover.png",
      birthday: new Date("1995-04-05T00:00:00.000Z"),
      gender: UserGender.FEMALE,
      bio: "friend profile",
    });
    const stranger = await seedUser(harness, "Live Enrich Stranger");
    await seedFriendship(harness, viewer.id, friend.id);

    const selfProfile = await harness.api.get(`/v1/users/${friend.id}/public`, friend.id);
    expect(selfProfile.status).toBe(200);
    expect(selfProfile.data.data).toEqual(
      expect.objectContaining({
        id: friend.id,
        username: friend.username,
        avatarUrl: "https://cdn.test/live-enrich-friend-avatar.png",
        coverUrl: "https://cdn.test/live-enrich-friend-cover.png",
        gender: UserGender.FEMALE,
        email: "live-enrich-friend@example.test",
        relationship: expect.objectContaining({
          status: "self",
          isSelf: true,
          isFriend: true,
          isBlockedByMe: false,
          isBlockingMe: false,
        }),
        fieldVisibility: expect.objectContaining({
          avatarUrl: "visible",
          coverUrl: "visible",
          birthday: "visible",
          phone: "visible",
          email: "visible",
        }),
        canSendMessage: false,
      }),
    );

    const friendProfile = await harness.api.get(`/v1/users/${friend.id}/public`, viewer.id);
    expect(friendProfile.status).toBe(200);
    expect(friendProfile.data.data).toEqual(
      expect.objectContaining({
        email: "live-enrich-friend@example.test",
        relationship: expect.objectContaining({
          status: "friend",
          isSelf: false,
          isFriend: true,
        }),
        fieldVisibility: expect.objectContaining({
          email: "visible",
        }),
        canSendMessage: true,
      }),
    );

    const strangerProfile = await harness.api.get(`/v1/users/${friend.id}/public`, stranger.id);
    expect(strangerProfile.status).toBe(200);
    expect(strangerProfile.data.data.email).toBeUndefined();
    expect(strangerProfile.data.data).toEqual(
      expect.objectContaining({
        relationship: expect.objectContaining({
          status: "none",
          isSelf: false,
          isFriend: false,
          isBlockedByMe: false,
          isBlockingMe: false,
        }),
        fieldVisibility: expect.objectContaining({
          email: "hidden",
        }),
      }),
    );

    const blocker = await seedUser(harness, "Live Enrich Blocker");
    const blocked1 = await seedUser(harness, "Live Enrich Blocked 1", {
      email: "live-enrich-blocked-1@example.test",
      avatarUrl: "https://cdn.test/live-enrich-blocked-1-avatar.png",
      coverUrl: "https://cdn.test/live-enrich-blocked-1-cover.png",
      bio: "blocked one",
    });
    const blocked2 = await seedUser(harness, "Live Enrich Blocked 2");
    const deletedBlocked = await seedUser(harness, "Live Enrich Deleted Blocked");

    for (const blocked of [blocked1, blocked2, deletedBlocked]) {
      const response = await harness.api.post(`/v1/blocks/${blocked.id}`, {}, blocker.id);
      expect(response.status).toBe(200);
      harness.trackBlock(blocker.id, blocked.id);
    }
    await harness.repos.user.delete(deletedBlocked.id, true);

    await eventually(async () => {
      const page = await harness.api.get("/v1/blocks?page=1&limit=3", blocker.id);
      expect(page.status).toBe(200);
      expect(page.data.data.total).toBe(3);
      expect(page.data.data.page).toBe(1);
      expect(page.data.data.limit).toBe(3);
      expect(page.data.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            blockerId: blocker.id,
            blockedUserId: blocked1.id,
            blockedUserUnavailable: false,
            blockedUser: expect.objectContaining({
              id: blocked1.id,
              displayName: blocked1.displayName,
              username: blocked1.username,
              avatarUrl: "https://cdn.test/live-enrich-blocked-1-avatar.png",
              coverUrl: "https://cdn.test/live-enrich-blocked-1-cover.png",
              bio: "blocked one",
              status: "active",
            }),
          }),
          expect.objectContaining({
            blockerId: blocker.id,
            blockedUserId: deletedBlocked.id,
            blockedUser: null,
            blockedUserUnavailable: true,
          }),
        ]),
      );
      const blockedOne = page.data.data.items.find((item: any) => item.blockedUserId === blocked1.id);
      expect(blockedOne.blockedUser.email).toBeUndefined();
    });

    const firstCursorPage = await harness.api.get("/v1/blocks/cursor?limit=2", blocker.id);
    expect(firstCursorPage.status).toBe(200);
    expect(firstCursorPage.data.data.items).toHaveLength(2);
    expect(firstCursorPage.data.data.hasMore).toBe(true);
    expect(firstCursorPage.data.data.limit).toBe(2);
    expect(firstCursorPage.data.data.nextCursor).toBeTruthy();
    expect(firstCursorPage.data.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockerId: blocker.id,
          blockedUserId: expect.any(String),
          blockedUserUnavailable: expect.any(Boolean),
        }),
      ]),
    );

    const secondCursorPage = await harness.api.get(
      `/v1/blocks/cursor?limit=2&cursor=${encodeURIComponent(firstCursorPage.data.data.nextCursor)}`,
      blocker.id,
    );
    expect(secondCursorPage.status).toBe(200);
    expect(secondCursorPage.data.data.items).toHaveLength(1);
    expect(secondCursorPage.data.data.hasMore).toBe(false);
    expect(secondCursorPage.data.data.nextCursor).toBe("");
    expect(secondCursorPage.data.data.limit).toBe(2);
  });
});
