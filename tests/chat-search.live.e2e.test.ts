import { v7 } from "uuid";
import {
  ClassificationType,
  ConversationMemberStatus,
  MessageStatus,
  MessageType,
  MediaType,
} from "@modules/chat/model";
import { UserStatus as UserAccountStatus } from "@modules/user/model/model";
import {
  createLiveChatE2EHarness,
  eventually,
  LiveChatE2EHarness,
  seedGroupConversation,
  seedMessage,
  seedPrivateConversation,
  seedUser,
} from "./helpers/chat-live-e2e-harness";

const liveDescribe = process.env.RUN_LIVE_CHAT_E2E === "true" ? describe : describe.skip;

const makeMedia = (filename: string, mimetype: string) => ({
  url: `https://cdn.live-e2e.test/${filename}`,
  filename,
  mimetype,
  size: 2048,
});

const idsOf = (items: Array<{ id: string }>) => items.map((item) => item.id);

async function sendConversationMessage(
  harness: LiveChatE2EHarness,
  conversationId: string,
  senderId: string,
  body: { text?: string; media?: any[] },
) {
  const response = await harness.api.post(`/v2/conversations/${conversationId}/messages`, body, senderId);
  expect(response.status).toBe(201);
  return response.data.data;
}

liveDescribe("chat search live E2E with real app and DynamoDB repositories", () => {
  let harness: LiveChatE2EHarness;

  jest.setTimeout(90_000);

  beforeEach(async () => {
    harness = await createLiveChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("searches users by display name, username and phone while applying privacy, block and active filters", async () => {
    const requester = await seedUser(harness, "Live Search Requester");
    const byName = await seedUser(harness, "Live Visible Search Name");
    const byUsername = await seedUser(harness, "Live Username Target", {
      username: `live_username_target_${v7().replace(/-/g, "").slice(-8)}`,
    });
    const byPhone = await seedUser(harness, "Live Phone Target", {
      phone: `849${v7().replace(/\D/g, "").padEnd(9, "1").slice(0, 9)}`,
    });
    const hiddenPhone = await seedUser(harness, "Live Hidden Phone", {
      phone: `849${v7().replace(/\D/g, "").padEnd(9, "2").slice(0, 9)}`,
      privacy: { searchableByPhone: false, searchableByUsername: true },
    });
    const inactive = await seedUser(harness, "Live Disabled Search Name", {
      status: UserAccountStatus.DISABLED,
    });
    const blocked = await seedUser(harness, "Live Blocked Search Name");
    await harness.repos.block.insert({
      id: v7(),
      blockerId: requester.id,
      blockedUserId: blocked.id,
      createdAt: new Date(),
    } as any);
    harness.trackBlock(requester.id, blocked.id);

    await eventually(async () => {
      const response = await harness.api.get(
        `/v1/search?type=USERS&query=${encodeURIComponent("visible search name")}`,
        requester.id,
      );
      expect(response.status).toBe(200);
      expect(idsOf(response.data.data.users)).toContain(byName.id);
    });

    const usernameResponse = await harness.api.get(
      `/v1/search?type=USERS&query=${encodeURIComponent(byUsername.username!)}`,
      requester.id,
    );
    expect(usernameResponse.status).toBe(200);
    expect(idsOf(usernameResponse.data.data.users)).toContain(byUsername.id);

    const phoneResponse = await harness.api.get(
      `/v1/search?type=USERS&query=${encodeURIComponent(byPhone.phone!)}`,
      requester.id,
    );
    expect(phoneResponse.status).toBe(200);
    expect(idsOf(phoneResponse.data.data.users)).toContain(byPhone.id);

    const hiddenPhoneResponse = await harness.api.get(
      `/v1/search?type=USERS&query=${encodeURIComponent(hiddenPhone.phone!)}`,
      requester.id,
    );
    expect(hiddenPhoneResponse.status).toBe(200);
    expect(idsOf(hiddenPhoneResponse.data.data.users)).not.toContain(hiddenPhone.id);

    const inactiveResponse = await harness.api.get(
      `/v1/search?type=USERS&query=${encodeURIComponent("Disabled Search Name")}`,
      requester.id,
    );
    expect(inactiveResponse.status).toBe(200);
    expect(idsOf(inactiveResponse.data.data.users)).not.toContain(inactive.id);

    const blockedResponse = await harness.api.get(
      `/v1/search?type=USERS&query=${encodeURIComponent("Blocked Search Name")}`,
      requester.id,
    );
    expect(blockedResponse.status).toBe(200);
    expect(idsOf(blockedResponse.data.data.users)).not.toContain(blocked.id);
  });

  it("searches private and group messages with context, date range, visibility filters and auth checks", async () => {
    const privateSeed = await seedPrivateConversation(harness);
    const groupSeed = await seedGroupConversation(harness);
    const privateConversation = privateSeed.conversation;
    const groupConversation = groupSeed.conversation;

    const olderContext = await seedMessage(harness, {
      conversationId: privateConversation.id,
      senderId: privateSeed.userB.id,
      text: "live context before",
      createdAt: new Date("2026-02-10T10:00:00.000Z"),
    });
    const target = await seedMessage(harness, {
      conversationId: privateConversation.id,
      senderId: privateSeed.userA.id,
      text: "Live Needle CASE private target",
      createdAt: new Date("2026-02-10T10:01:00.000Z"),
    });
    const newerContext = await seedMessage(harness, {
      conversationId: privateConversation.id,
      senderId: privateSeed.userB.id,
      text: "live context after",
      createdAt: new Date("2026-02-10T10:02:00.000Z"),
    });
    const revoked = await seedMessage(harness, {
      conversationId: privateConversation.id,
      senderId: privateSeed.userA.id,
      text: "live needle revoked",
      messageStatus: MessageStatus.REVOKED,
      createdAt: new Date("2026-02-10T10:03:00.000Z"),
    });
    const deletedForMe = await seedMessage(harness, {
      conversationId: privateConversation.id,
      senderId: privateSeed.userB.id,
      text: "live needle deleted locally",
      deletedForUserIds: [privateSeed.userA.id],
      createdAt: new Date("2026-02-10T10:04:00.000Z"),
    });
    const expired = await seedMessage(harness, {
      conversationId: privateConversation.id,
      senderId: privateSeed.userA.id,
      text: "live needle expired",
      expireAtEpoch: Math.floor(Date.now() / 1000) - 5,
      createdAt: new Date("2026-02-10T10:05:00.000Z"),
    });
    const insideRange = await seedMessage(harness, {
      conversationId: privateConversation.id,
      senderId: privateSeed.userB.id,
      text: "live-range-keyword inside",
      createdAt: new Date("2026-02-15T12:00:00.000Z"),
    });
    const outsideRange = await seedMessage(harness, {
      conversationId: privateConversation.id,
      senderId: privateSeed.userA.id,
      text: "live-range-keyword outside",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
    });
    const groupTarget = await seedMessage(harness, {
      conversationId: groupConversation.id,
      senderId: groupSeed.owner.id,
      text: "live group needle payload",
      createdAt: new Date("2026-02-11T10:00:00.000Z"),
    });

    await eventually(async () => {
      const response = await harness.api.get(
        `/v1/conversations/${privateConversation.id}/search?query=${encodeURIComponent("needle case")}&contextLimit=1`,
        privateSeed.userA.id,
      );
      expect(response.status).toBe(200);
      expect(idsOf(response.data.data.messages)).toEqual([target.id]);
      expect(response.data.data.messages[0].context.before.map((message: any) => message.id)).toEqual([
        olderContext.id,
      ]);
      expect(response.data.data.messages[0].context.after.map((message: any) => message.id)).toEqual([
        newerContext.id,
      ]);
      expect(idsOf(response.data.data.messages)).not.toEqual(
        expect.arrayContaining([revoked.id, deletedForMe.id, expired.id]),
      );
    });

    const rangeResponse = await harness.api.get(
      `/v1/conversations/${privateConversation.id}/search?query=live-range-keyword&from=2026-02-01&to=2026-02-28`,
      privateSeed.userA.id,
    );
    expect(rangeResponse.status).toBe(200);
    expect(idsOf(rangeResponse.data.data.messages)).toEqual([insideRange.id]);
    expect(idsOf(rangeResponse.data.data.messages)).not.toContain(outsideRange.id);

    const groupResponse = await harness.api.get(
      `/v1/conversations/${groupConversation.id}/search?query=${encodeURIComponent("GROUP NEEDLE")}`,
      groupSeed.member.id,
    );
    expect(groupResponse.status).toBe(200);
    expect(idsOf(groupResponse.data.data.messages)).toEqual([groupTarget.id]);

    const outsider = await seedUser(harness, "Live Search Outsider");
    const unauthorized = await harness.api.get(
      `/v1/conversations/${privateConversation.id}/search?query=needle`,
      outsider.id,
    );
    expect(unauthorized.status).toBe(403);
  });

  it("searches groups by name and member identity only for active members", async () => {
    const groupSeed = await seedGroupConversation(harness);
    await harness.repos.conversation.update(groupSeed.conversation.id, {
      name: "Live Backend Search Squad",
    } as any);

    const nameResponse = await harness.api.get(
      `/v1/search?type=GROUPS&query=${encodeURIComponent("backend search squad")}`,
      groupSeed.owner.id,
    );
    expect(nameResponse.status).toBe(200);
    expect(idsOf(nameResponse.data.data.groups)).toContain(groupSeed.conversation.id);

    await harness.repos.conversation.update(groupSeed.conversation.id, {
      name: "Live Engineering Room",
    } as any);
    const memberResponse = await harness.api.get(
      `/v1/search?type=GROUPS&query=${encodeURIComponent(groupSeed.member.username!)}`,
      groupSeed.owner.id,
    );
    expect(memberResponse.status).toBe(200);
    expect(idsOf(memberResponse.data.data.groups)).toContain(groupSeed.conversation.id);
    expect(memberResponse.data.data.groups[0].matchedMembers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: groupSeed.member.id })]),
    );

    const inactiveGroup = await seedGroupConversation(harness);
    await harness.repos.conversation.update(inactiveGroup.conversation.id, {
      name: "Live Former Hidden Group",
    } as any);
    const ownerMember = await harness.repos.member.findByCond({
      conversationId: inactiveGroup.conversation.id,
      userId: inactiveGroup.owner.id,
    });
    await harness.repos.member.update(ownerMember!.id, { status: ConversationMemberStatus.REJECTED } as any);
    const inactiveResponse = await harness.api.get(
      `/v1/search?type=GROUPS&query=${encodeURIComponent("former hidden")}`,
      inactiveGroup.owner.id,
    );
    expect(inactiveResponse.status).toBe(200);
    expect(idsOf(inactiveResponse.data.data.groups)).not.toContain(inactiveGroup.conversation.id);
  });

  it.each(["private", "group"] as const)(
    "classifies sent media/link messages and exposes them through media search on the %s path",
    async (mode) => {
      let sender: { id: string };
      let conversation: { id: string };
      if (mode === "private") {
        const seed = await seedPrivateConversation(harness);
        sender = seed.userA;
        conversation = seed.conversation;
      } else {
        const seed = await seedGroupConversation(harness);
        sender = seed.owner;
        conversation = seed.conversation;
      }
      const cases = [
        {
          attachment: makeMedia(`live-${mode}-photo.png`, "image/png"),
          messageType: MessageType.IMAGE,
          mediaType: MediaType.IMAGE,
          classificationType: ClassificationType.IMAGE,
          mediaQueryType: "image",
          bucket: "images",
          endpointMediaType: MediaType.IMAGE,
        },
        {
          attachment: makeMedia(`live-${mode}-clip.mp4`, "video/mp4"),
          messageType: MessageType.VIDEO,
          mediaType: MediaType.VIDEO,
          classificationType: ClassificationType.VIDEO,
          mediaQueryType: "video",
          bucket: "images",
          endpointMediaType: MediaType.VIDEO,
        },
        {
          attachment: makeMedia(`live-${mode}-voice.m4a`, "audio/mp4"),
          messageType: MessageType.VOICE,
          mediaType: MediaType.AUDIO,
          classificationType: ClassificationType.VOICE,
          mediaQueryType: "voice",
          bucket: "files",
          endpointMediaType: MediaType.AUDIO,
        },
        {
          attachment: makeMedia(`live-${mode}-document.pdf`, "application/pdf"),
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

        await eventually(async () => {
          const classifications = await harness.repos.classification.listByConversationAndType(
            conversation.id,
            item.classificationType,
            undefined,
            20,
          );
          expect(classifications.items).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                messageId: message.id,
                type: item.classificationType,
                url: item.attachment.url,
                name: item.attachment.filename,
              }),
            ]),
          );
        });

        await eventually(async () => {
          const mediaResponse = await harness.api.get(
            `/v1/conversations/${conversation.id}/media?type=${item.mediaQueryType}`,
            sender.id,
          );
          expect(mediaResponse.status).toBe(200);
          expect(mediaResponse.data.data[item.bucket]).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ messageId: message.id, mediaType: item.endpointMediaType }),
            ]),
          );
        });
      }

      const [linkOnly] = await sendConversationMessage(harness, conversation.id, sender.id, {
        text: `read https://live-e2e.test/${mode}/only now`,
      });
      expect(linkOnly).toEqual(
        expect.objectContaining({
          type: MessageType.LINK,
          links: [`https://live-e2e.test/${mode}/only`],
        }),
      );

      const combo = await sendConversationMessage(harness, conversation.id, sender.id, {
        text: `combo https://live-e2e.test/${mode}/combo`,
        media: [
          makeMedia(`live-${mode}-combo.png`, "image/png"),
          makeMedia(`live-${mode}-combo.pdf`, "application/pdf"),
        ],
      });
      expect(combo.map((message: any) => message.type)).toEqual([
        MessageType.IMAGE,
        MessageType.FILE,
        MessageType.LINK,
      ]);

      await eventually(async () => {
        const links = await harness.api.get(`/v1/conversations/${conversation.id}/media?type=link`, sender.id);
        expect(links.status).toBe(200);
        expect(links.data.data.links).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ messageId: linkOnly.id, url: `https://live-e2e.test/${mode}/only` }),
            expect.objectContaining({ messageId: combo[2].id, url: `https://live-e2e.test/${mode}/combo` }),
          ]),
        );
      });
    },
  );

  it("filters revoked, expired and deleted-for-me media classifications in the real media endpoint", async () => {
    const { userA, userB, conversation } = await seedPrivateConversation(harness);
    const visible = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: userA.id,
      type: MessageType.IMAGE,
      media: [{ url: "https://cdn.live-e2e.test/visible.png", mediaType: MediaType.IMAGE, name: "visible.png" }],
      createdAt: new Date("2026-02-10T10:00:00.000Z"),
    });
    const deleted = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: userB.id,
      type: MessageType.IMAGE,
      deletedForUserIds: [userA.id],
      media: [{ url: "https://cdn.live-e2e.test/deleted.png", mediaType: MediaType.IMAGE, name: "deleted.png" }],
      createdAt: new Date("2026-02-10T10:01:00.000Z"),
    });
    const expired = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: userB.id,
      type: MessageType.IMAGE,
      expireAtEpoch: Math.floor(Date.now() / 1000) - 10,
      media: [{ url: "https://cdn.live-e2e.test/expired.png", mediaType: MediaType.IMAGE, name: "expired.png" }],
      createdAt: new Date("2026-02-10T10:02:00.000Z"),
    });
    const revoked = await seedMessage(harness, {
      conversationId: conversation.id,
      senderId: userB.id,
      type: MessageType.IMAGE,
      messageStatus: MessageStatus.REVOKED,
      media: [{ url: "https://cdn.live-e2e.test/revoked.png", mediaType: MediaType.IMAGE, name: "revoked.png" }],
      createdAt: new Date("2026-02-10T10:03:00.000Z"),
    });

    await harness.repos.classification.insertBatch([
      {
        id: v7(),
        conversationId: conversation.id,
        type: ClassificationType.IMAGE,
        senderId: userA.id,
        url: "https://cdn.live-e2e.test/visible.png",
        name: "visible.png",
        messageId: visible.id,
        createdAt: visible.createdAt,
      },
      {
        id: v7(),
        conversationId: conversation.id,
        type: ClassificationType.IMAGE,
        senderId: userB.id,
        url: "https://cdn.live-e2e.test/deleted.png",
        name: "deleted.png",
        messageId: deleted.id,
        createdAt: deleted.createdAt,
      },
      {
        id: v7(),
        conversationId: conversation.id,
        type: ClassificationType.IMAGE,
        senderId: userB.id,
        url: "https://cdn.live-e2e.test/expired.png",
        name: "expired.png",
        messageId: expired.id,
        createdAt: expired.createdAt,
      },
      {
        id: v7(),
        conversationId: conversation.id,
        type: ClassificationType.IMAGE,
        senderId: userB.id,
        url: "https://cdn.live-e2e.test/revoked.png",
        name: "revoked.png",
        messageId: revoked.id,
        createdAt: revoked.createdAt,
      },
    ]);

    await eventually(async () => {
      const response = await harness.api.get(`/v1/conversations/${conversation.id}/media?type=image`, userA.id);
      expect(response.status).toBe(200);
      expect(response.data.data.images.map((item: any) => item.messageId)).toEqual([visible.id]);
    });
  });
});
