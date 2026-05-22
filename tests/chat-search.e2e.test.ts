import {
  ClassificationType,
  ConversationMemberStatus,
  MessageStatus,
  MessageType,
  MediaType,
  UserStatus,
} from "@modules/chat/model";
import {
  authHeader,
  ChatE2EHarness,
  createChatE2EHarness,
  seedGroupConversation,
  seedPrivateConversation,
} from "./helpers/chat-e2e-harness";

const makeMedia = (filename: string, mimetype: string) => ({
  url: `https://cdn.test/${filename}`,
  filename,
  mimetype,
  size: 1234,
});

const idsOf = (items: Array<{ id: string }>) => items.map((item) => item.id);

async function sendConversationMessage(
  harness: ChatE2EHarness,
  conversationId: string,
  senderId: string,
  body: { text?: string; media?: any[] },
) {
  const response = await harness.api.post(
    `/v2/conversations/${conversationId}/messages`,
    body,
    { headers: authHeader(senderId) },
  );
  expect(response.status).toBe(201);
  return response.data.data;
}

function seedConversationForMode(harness: ChatE2EHarness, mode: "private" | "group") {
  if (mode === "private") {
    const { userA, userB, conversation } = seedPrivateConversation(harness.store);
    return { sender: userA, viewer: userB, conversation };
  }

  const { owner, member, conversation } = seedGroupConversation(harness.store);
  return { sender: owner, viewer: member, conversation };
}

describe("chat search REST E2E", () => {
  let harness: ChatE2EHarness;

  beforeEach(async () => {
    harness = await createChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("searches users by display name, username and phone while excluding private, blocked and inactive users", async () => {
    const requester = harness.store.addUser({ displayName: "Requester" });
    const byName = harness.store.addUser({
      displayName: "Visible Search Name",
      username: "visible_name",
      phone: "0901000001",
    });
    const byUsername = harness.store.addUser({
      displayName: "Regular User",
      username: "alpha_handle",
      phone: "0901000002",
    });
    const byPhone = harness.store.addUser({
      displayName: "Phone User",
      username: "phone_user",
      phone: "84901234567",
    });
    const hiddenPhone = harness.store.addUser({
      displayName: "Hidden Contact",
      phone: "555-PRIVATE",
      privacy: { searchableByPhone: false },
    });
    const inactive = harness.store.addUser({
      displayName: "Dormant Search Name",
      status: UserStatus.DISABLED,
    });
    const blocked = harness.store.addUser({ displayName: "Blocked Search Name" });
    harness.store.blocks.add(`${requester.id}#${blocked.id}`);

    const nameResponse = await harness.api.get("/v1/search", {
      params: { type: "USERS", query: "visible search" },
      headers: authHeader(requester.id),
    });
    expect(nameResponse.status).toBe(200);
    expect(idsOf(nameResponse.data.data.users)).toEqual([byName.id]);

    const usernameResponse = await harness.api.get("/v1/search", {
      params: { type: "USERS", query: "alpha_handle" },
      headers: authHeader(requester.id),
    });
    expect(usernameResponse.status).toBe(200);
    expect(idsOf(usernameResponse.data.data.users)).toEqual([byUsername.id]);

    const phoneResponse = await harness.api.get("/v1/search", {
      params: { type: "USERS", query: "84901234567" },
      headers: authHeader(requester.id),
    });
    expect(phoneResponse.status).toBe(200);
    expect(idsOf(phoneResponse.data.data.users)).toEqual([byPhone.id]);

    const excludedQueries = [
      { query: "555-PRIVATE", excludedId: hiddenPhone.id },
      { query: "Dormant Search", excludedId: inactive.id },
      { query: "Blocked Search", excludedId: blocked.id },
    ];
    for (const item of excludedQueries) {
      const response = await harness.api.get("/v1/search", {
        params: { type: "USERS", query: item.query },
        headers: authHeader(requester.id),
      });
      expect(response.status).toBe(200);
      expect(idsOf(response.data.data.users)).not.toContain(item.excludedId);
    }
  });

  it("searches messages in private and group conversations with context, date range and visibility filters", async () => {
    const privateSeed = seedPrivateConversation(harness.store);
    const groupSeed = seedGroupConversation(harness.store);
    const privateConversation = privateSeed.conversation;
    const groupConversation = groupSeed.conversation;

    const olderContext = harness.store.addMessage({
      conversationId: privateConversation.id,
      senderId: privateSeed.userB.id,
      text: "private context before",
      createdAt: new Date("2026-02-10T10:00:00.000Z"),
    });
    const target = harness.store.addMessage({
      conversationId: privateConversation.id,
      senderId: privateSeed.userA.id,
      text: "Needle CASE private target",
      createdAt: new Date("2026-02-10T10:01:00.000Z"),
    });
    const newerContext = harness.store.addMessage({
      conversationId: privateConversation.id,
      senderId: privateSeed.userB.id,
      text: "private context after",
      createdAt: new Date("2026-02-10T10:02:00.000Z"),
    });
    const revoked = harness.store.addMessage({
      conversationId: privateConversation.id,
      senderId: privateSeed.userA.id,
      text: "needle revoked",
      messageStatus: MessageStatus.REVOKED,
      createdAt: new Date("2026-02-10T10:03:00.000Z"),
    });
    const deletedForMe = harness.store.addMessage({
      conversationId: privateConversation.id,
      senderId: privateSeed.userB.id,
      text: "needle deleted locally",
      deletedForUserIds: [privateSeed.userA.id],
      createdAt: new Date("2026-02-10T10:04:00.000Z"),
    });
    const expired = harness.store.addMessage({
      conversationId: privateConversation.id,
      senderId: privateSeed.userA.id,
      text: "needle expired",
      expireAtEpoch: Math.floor(Date.now() / 1000) - 5,
      createdAt: new Date("2026-02-10T10:05:00.000Z"),
    });
    const outsideRange = harness.store.addMessage({
      conversationId: privateConversation.id,
      senderId: privateSeed.userA.id,
      text: "range-keyword outside",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    const insideRange = harness.store.addMessage({
      conversationId: privateConversation.id,
      senderId: privateSeed.userB.id,
      text: "range-keyword inside",
      createdAt: new Date("2026-02-15T12:00:00.000Z"),
    });
    const groupTarget = harness.store.addMessage({
      conversationId: groupConversation.id,
      senderId: groupSeed.owner.id,
      text: "group needle payload",
      createdAt: new Date("2026-02-11T10:00:00.000Z"),
    });

    const searchResponse = await harness.api.get(
      `/v1/conversations/${privateConversation.id}/search`,
      {
        params: { query: "needle case", contextLimit: 1 },
        headers: authHeader(privateSeed.userA.id),
      },
    );
    expect(searchResponse.status).toBe(200);
    expect(idsOf(searchResponse.data.data.messages)).toEqual([target.id]);
    expect(searchResponse.data.data.messages[0].context.before.map((message: any) => message.id)).toEqual([
      olderContext.id,
    ]);
    expect(searchResponse.data.data.messages[0].context.after.map((message: any) => message.id)).toEqual([
      newerContext.id,
    ]);
    expect(idsOf(searchResponse.data.data.messages)).not.toEqual(
      expect.arrayContaining([revoked.id, deletedForMe.id, expired.id]),
    );

    const rangeResponse = await harness.api.get(
      `/v1/conversations/${privateConversation.id}/search`,
      {
        params: { query: "range-keyword", from: "2026-02-01", to: "2026-02-28" },
        headers: authHeader(privateSeed.userA.id),
      },
    );
    expect(rangeResponse.status).toBe(200);
    expect(idsOf(rangeResponse.data.data.messages)).toEqual([insideRange.id]);
    expect(idsOf(rangeResponse.data.data.messages)).not.toContain(outsideRange.id);

    const groupResponse = await harness.api.get(`/v1/conversations/${groupConversation.id}/search`, {
      params: { query: "GROUP NEEDLE" },
      headers: authHeader(groupSeed.member.id),
    });
    expect(groupResponse.status).toBe(200);
    expect(idsOf(groupResponse.data.data.messages)).toEqual([groupTarget.id]);

    const outsider = harness.store.addUser({ displayName: "Outsider" });
    const unauthorized = await harness.api.get(`/v1/conversations/${privateConversation.id}/search`, {
      params: { query: "needle" },
      headers: authHeader(outsider.id),
    });
    expect(unauthorized.status).toBe(403);
  });

  it("keeps cursor and limit stable for conversation message search", async () => {
    const { userA, conversation } = seedPrivateConversation(harness.store);
    const oldest = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: userA.id,
      text: "paged-term oldest",
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
    });
    const middle = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: userA.id,
      text: "paged-term middle",
      createdAt: new Date("2026-02-01T10:01:00.000Z"),
    });
    const newest = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: userA.id,
      text: "paged-term newest",
      createdAt: new Date("2026-02-01T10:02:00.000Z"),
    });

    const firstPage = await harness.api.get(`/v1/conversations/${conversation.id}/search`, {
      params: { query: "paged-term", limit: 2, contextLimit: 0 },
      headers: authHeader(userA.id),
    });
    expect(firstPage.status).toBe(200);
    expect(idsOf(firstPage.data.data.messages)).toEqual([newest.id, middle.id]);
    expect(firstPage.data.data.hasMore).toBe(true);
    expect(firstPage.data.data.nextCursor).toBe(middle.id);

    const secondPage = await harness.api.get(`/v1/conversations/${conversation.id}/search`, {
      params: { query: "paged-term", limit: 2, cursor: firstPage.data.data.nextCursor, contextLimit: 0 },
      headers: authHeader(userA.id),
    });
    expect(secondPage.status).toBe(200);
    expect(idsOf(secondPage.data.data.messages)).toEqual([oldest.id]);
    expect(secondPage.data.data.hasMore).toBe(false);
  });

  it("returns an opaque reusable cursor for global message search", async () => {
    const requester = harness.store.addUser({ displayName: "Requester" });
    const peer = harness.store.addUser({ displayName: "Peer" });
    const { conversation } = seedPrivateConversation(harness.store, requester, peer);
    const older = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: requester.id,
      text: "global-paged-term older",
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
    });
    const newer = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: requester.id,
      text: "global-paged-term newer",
      createdAt: new Date("2026-02-01T10:01:00.000Z"),
    });

    const firstPage = await harness.api.get("/v1/search", {
      params: { type: "MESSAGES", query: "global-paged-term", limit: 1, contextLimit: 0 },
      headers: authHeader(requester.id),
    });
    expect(firstPage.status).toBe(200);
    expect(idsOf(firstPage.data.data.messages)).toEqual([newer.id]);
    expect(firstPage.data.data.hasMore).toBe(true);
    expect(firstPage.data.data.nextCursor).toEqual(expect.any(String));
    expect(firstPage.data.data.nextCursor).not.toBe(newer.id);

    const secondPage = await harness.api.get("/v1/search", {
      params: {
        type: "MESSAGES",
        query: "global-paged-term",
        limit: 1,
        cursor: firstPage.data.data.nextCursor,
        contextLimit: 0,
      },
      headers: authHeader(requester.id),
    });
    expect(secondPage.status).toBe(200);
    expect(idsOf(secondPage.data.data.messages)).toEqual([older.id]);
    expect(secondPage.data.data.hasMore).toBe(false);
  });

  it("searches groups by group name and active member identity", async () => {
    const groupSeed = seedGroupConversation(harness.store);
    groupSeed.conversation.name = "Backend Search Squad";
    const activeMember = groupSeed.member as any;
    activeMember.displayName = "Search Member";
    activeMember.username = "member_lookup";
    activeMember.phone = "0907777777";

    const nameResponse = await harness.api.get("/v1/search", {
      params: { type: "GROUPS", query: "backend search" },
      headers: authHeader(groupSeed.owner.id),
    });
    expect(nameResponse.status).toBe(200);
    expect(idsOf(nameResponse.data.data.groups)).toEqual([groupSeed.conversation.id]);
    expect(nameResponse.data.data.conversations).toHaveLength(1);

    groupSeed.conversation.name = "Engineering Room";
    const memberResponse = await harness.api.get("/v1/search", {
      params: { type: "GROUPS", query: "member_lookup" },
      headers: authHeader(groupSeed.owner.id),
    });
    expect(memberResponse.status).toBe(200);
    expect(idsOf(memberResponse.data.data.groups)).toEqual([groupSeed.conversation.id]);
    expect(memberResponse.data.data.groups[0].matchedMembers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: groupSeed.member.id })]),
    );

    const inactiveGroup = seedGroupConversation(harness.store);
    inactiveGroup.conversation.name = "Hidden Former Group";
    harness.store.getMember(inactiveGroup.conversation.id, inactiveGroup.owner.id)!.status =
      ConversationMemberStatus.REJECTED;
    const inactiveResponse = await harness.api.get("/v1/search", {
      params: { type: "GROUPS", query: "hidden former" },
      headers: authHeader(inactiveGroup.owner.id),
    });
    expect(inactiveResponse.status).toBe(200);
    expect(idsOf(inactiveResponse.data.data.groups)).not.toContain(inactiveGroup.conversation.id);
  });

  it("filters media and links in a conversation while hiding revoked, expired and deleted-for-me messages", async () => {
    const { userA, userB, conversation } = seedPrivateConversation(harness.store);
    const imageMessage = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: userA.id,
      type: MessageType.IMAGE,
      media: [{ url: "https://cdn.test/visible.png", mediaType: MediaType.IMAGE, name: "visible.png" }],
      createdAt: new Date("2026-02-10T10:00:00.000Z"),
    });
    const linkMessage = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: userA.id,
      type: MessageType.LINK,
      text: "https://visible.test",
      links: ["https://visible.test"],
      createdAt: new Date("2026-02-10T10:01:00.000Z"),
    });
    const deletedImage = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: userB.id,
      type: MessageType.IMAGE,
      media: [{ url: "https://cdn.test/deleted.png", mediaType: MediaType.IMAGE, name: "deleted.png" }],
      deletedForUserIds: [userA.id],
      createdAt: new Date("2026-02-10T10:02:00.000Z"),
    });
    const expiredLink = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: userB.id,
      type: MessageType.LINK,
      text: "https://expired.test",
      links: ["https://expired.test"],
      expireAtEpoch: Math.floor(Date.now() / 1000) - 10,
      createdAt: new Date("2026-02-10T10:03:00.000Z"),
    });
    const revokedFile = harness.store.addMessage({
      conversationId: conversation.id,
      senderId: userB.id,
      type: MessageType.FILE,
      media: [{ url: "https://cdn.test/revoked.pdf", mediaType: MediaType.FILE, name: "revoked.pdf" }],
      messageStatus: MessageStatus.REVOKED,
      createdAt: new Date("2026-02-10T10:04:00.000Z"),
    });
    harness.store.classifications.push(
      {
        id: "classification-image",
        conversationId: conversation.id,
        type: ClassificationType.IMAGE,
        senderId: userA.id,
        url: "https://cdn.test/visible.png",
        name: "visible.png",
        messageId: imageMessage.id,
        createdAt: imageMessage.createdAt,
      },
      {
        id: "classification-link",
        conversationId: conversation.id,
        type: ClassificationType.LINK,
        senderId: userA.id,
        linkUrl: "https://visible.test",
        messageId: linkMessage.id,
        createdAt: linkMessage.createdAt,
      },
      {
        id: "classification-deleted-image",
        conversationId: conversation.id,
        type: ClassificationType.IMAGE,
        senderId: userB.id,
        url: "https://cdn.test/deleted.png",
        name: "deleted.png",
        messageId: deletedImage.id,
        createdAt: deletedImage.createdAt,
      },
      {
        id: "classification-expired-link",
        conversationId: conversation.id,
        type: ClassificationType.LINK,
        senderId: userB.id,
        linkUrl: "https://expired.test",
        messageId: expiredLink.id,
        createdAt: expiredLink.createdAt,
      },
      {
        id: "classification-revoked-file",
        conversationId: conversation.id,
        type: ClassificationType.FILE,
        senderId: userB.id,
        url: "https://cdn.test/revoked.pdf",
        name: "revoked.pdf",
        messageId: revokedFile.id,
        createdAt: revokedFile.createdAt,
      },
    );

    const images = await harness.api.get(`/v1/conversations/${conversation.id}/media`, {
      params: { type: "image" },
      headers: authHeader(userA.id),
    });
    expect(images.status).toBe(200);
    expect(images.data.data.images.map((item: any) => item.messageId)).toEqual([imageMessage.id]);

    const links = await harness.api.get(`/v1/conversations/${conversation.id}/media`, {
      params: { type: "link" },
      headers: authHeader(userA.id),
    });
    expect(links.status).toBe(200);
    expect(links.data.data.links.map((item: any) => item.messageId)).toEqual([linkMessage.id]);

    const globalMedia = await harness.api.get("/v1/search", {
      params: { type: "MEDIA", conversationId: conversation.id, mediaType: "image" },
      headers: authHeader(userA.id),
    });
    expect(globalMedia.status).toBe(200);
    expect(globalMedia.data.data.media.map((item: any) => item.messageId)).toEqual([imageMessage.id]);

    const globalLinks = await harness.api.get("/v1/search", {
      params: { type: "LINKS", conversationId: conversation.id },
      headers: authHeader(userA.id),
    });
    expect(globalLinks.status).toBe(200);
    expect(globalLinks.data.data.links.map((item: any) => item.messageId)).toEqual([linkMessage.id]);
  });

  it.each(["private", "group"] as const)(
    "classifies sent image, video, voice, file and link messages on the %s send path",
    async (mode) => {
      const { sender, conversation } = seedConversationForMode(harness, mode);
      const cases = [
        {
          attachment: makeMedia("photo.png", "image/png"),
          messageType: MessageType.IMAGE,
          mediaType: MediaType.IMAGE,
          classificationType: ClassificationType.IMAGE,
          mediaQueryType: "image",
          bucket: "images",
          endpointMediaType: MediaType.IMAGE,
        },
        {
          attachment: makeMedia("clip.mp4", "video/mp4"),
          messageType: MessageType.VIDEO,
          mediaType: MediaType.VIDEO,
          classificationType: ClassificationType.VIDEO,
          mediaQueryType: "video",
          bucket: "images",
          endpointMediaType: MediaType.VIDEO,
        },
        {
          attachment: makeMedia("voice.m4a", "audio/mp4"),
          messageType: MessageType.VOICE,
          mediaType: MediaType.AUDIO,
          classificationType: ClassificationType.VOICE,
          mediaQueryType: "voice",
          bucket: "files",
          endpointMediaType: MediaType.AUDIO,
        },
        {
          attachment: makeMedia("document.pdf", "application/pdf"),
          messageType: MessageType.FILE,
          mediaType: MediaType.FILE,
          classificationType: ClassificationType.FILE,
          mediaQueryType: "file",
          bucket: "files",
          endpointMediaType: MediaType.FILE,
        },
      ];

      for (const item of cases) {
        const [message] = await sendConversationMessage(harness, conversation.id, sender.id, {
          media: [item.attachment],
        });

        expect(message).toEqual(
          expect.objectContaining({
            type: item.messageType,
            media: [expect.objectContaining({ mediaType: item.mediaType, name: item.attachment.filename })],
          }),
        );
        expect(harness.store.classifications).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              messageId: message.id,
              type: item.classificationType,
              url: item.attachment.url,
              name: item.attachment.filename,
            }),
          ]),
        );

        const mediaResponse = await harness.api.get(`/v1/conversations/${conversation.id}/media`, {
          params: { type: item.mediaQueryType },
          headers: authHeader(sender.id),
        });
        expect(mediaResponse.status).toBe(200);
        expect(mediaResponse.data.data[item.bucket]).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ messageId: message.id, mediaType: item.endpointMediaType }),
          ]),
        );
      }

      const [linkOnly] = await sendConversationMessage(harness, conversation.id, sender.id, {
        text: "read https://links.test/only now",
      });
      expect(linkOnly).toEqual(
        expect.objectContaining({
          type: MessageType.LINK,
          links: ["https://links.test/only"],
        }),
      );
      expect(harness.store.classifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            messageId: linkOnly.id,
            type: ClassificationType.LINK,
            linkUrl: "https://links.test/only",
          }),
        ]),
      );

      const combo = await sendConversationMessage(harness, conversation.id, sender.id, {
        text: "combo https://links.test/combo",
        media: [
          makeMedia("combo.png", "image/png"),
          makeMedia("combo.pdf", "application/pdf"),
        ],
      });
      expect(combo.map((message: any) => message.type)).toEqual([
        MessageType.IMAGE,
        MessageType.FILE,
        MessageType.LINK,
      ]);
      const [comboImage, comboFile, comboLink] = combo;
      expect(harness.store.classifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            messageId: comboImage.id,
            type: ClassificationType.IMAGE,
            name: "combo.png",
          }),
          expect.objectContaining({
            messageId: comboFile.id,
            type: ClassificationType.FILE,
            name: "combo.pdf",
          }),
          expect.objectContaining({
            messageId: comboLink.id,
            type: ClassificationType.LINK,
            linkUrl: "https://links.test/combo",
          }),
        ]),
      );
    },
  );
});
