import {
  assertMessageActiveForAction,
  classificationTypeForMediaType,
  extractLinks,
  getForwardedMessageType,
  getMessagePreview,
} from "@modules/chat/usecase/message-action-rules";
import {
  ClassificationType,
  MediaType,
  MessageStatus,
  MessageType,
} from "@modules/chat/model";

function message(overrides: Record<string, any> = {}) {
  return {
    id: "message-id",
    conversationId: "conversation-id",
    senderId: "sender-id",
    type: MessageType.TEXT,
    text: "hello",
    messageStatus: MessageStatus.ACTIVE,
    pinned: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as any;
}

describe("message action rules", () => {
  it("allows actions on active non-system messages", () => {
    expect(() => assertMessageActiveForAction(message(), "viewer-id", "forward")).not.toThrow();
    expect(() => assertMessageActiveForAction(message(), "viewer-id", "quote")).not.toThrow();
    expect(() => assertMessageActiveForAction(message(), "viewer-id", "react")).not.toThrow();
  });

  it.each([
    ["deleted", { deletedAt: new Date() }, "Message cannot be forwarded"],
    ["revoked", { messageStatus: MessageStatus.REVOKED }, "Message cannot be forwarded"],
    ["deleted for viewer", { deletedForUserIds: ["viewer-id"] }, "Message cannot be forwarded"],
  ])("rejects %s messages before action-specific logic", (_caseName, overrides, expected) => {
    expect(() => assertMessageActiveForAction(message(overrides), "viewer-id", "forward")).toThrow(expected);
  });

  it.each([
    ["forward", "System messages cannot be forwarded"],
    ["quote", "System messages cannot be quoted"],
    ["react", "System messages cannot be reacted to"],
  ] as const)("rejects system messages for %s", (action, expected) => {
    expect(() =>
      assertMessageActiveForAction(message({ type: MessageType.SYSTEM, text: undefined }), "viewer-id", action),
    ).toThrow(expected);
  });

  it("builds stable previews for text, media, call, and fallback message types", () => {
    expect(getMessagePreview(message({ text: "x".repeat(120) }))).toHaveLength(100);
    expect(getMessagePreview(message({ type: MessageType.IMAGE, text: undefined }))).toBe("Image");
    expect(getMessagePreview(message({ type: MessageType.VOICE, text: undefined }))).toBe("Voice message");
    expect(
      getMessagePreview(
        message({
          type: MessageType.CALL,
          text: undefined,
          call: { status: "completed", callType: "video" },
        }),
      ),
    ).toBe("Completed video call");
    expect(getMessagePreview(message({ type: MessageType.PROFILE_CARD, text: undefined }))).toBe("Profile card");
  });

  it("detects links and upgrades forwarded text messages with links to link type", () => {
    expect(extractLinks("See https://a.test and http://b.test/path")).toEqual([
      "https://a.test",
      "http://b.test/path",
    ]);
    expect(getForwardedMessageType(message({ text: "See https://a.test" }))).toBe(MessageType.LINK);
    expect(getForwardedMessageType(message({ type: MessageType.IMAGE, text: "https://a.test" }))).toBe(MessageType.IMAGE);
  });

  it.each([
    [MediaType.IMAGE, ClassificationType.IMAGE],
    [MediaType.VIDEO, ClassificationType.VIDEO],
    [MediaType.AUDIO, ClassificationType.VOICE],
    ["image", ClassificationType.IMAGE],
    ["other", ClassificationType.FILE],
  ])("maps media type %s to classification %s", (mediaType, expected) => {
    expect(classificationTypeForMediaType(mediaType)).toBe(expected);
  });
});
