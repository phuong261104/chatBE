import { AppError } from "@share/app-error";
import {
  ClassificationType,
  MediaType,
  Message,
  MessageStatus,
  MessageType,
} from "../model/model";

const SYSTEM_ACTION_ERROR: Record<string, string> = {
  forward: "System messages cannot be forwarded",
  quote: "System messages cannot be quoted",
  react: "System messages cannot be reacted to",
};

export function assertMessageActiveForAction(
  message: Message,
  userId: string,
  action: "forward" | "quote" | "react",
): void {
  if (
    message.deletedAt ||
    message.messageStatus === MessageStatus.REVOKED ||
    message.deletedForUserIds?.includes(userId)
  ) {
    throw AppError.from(new Error(`Message cannot be ${pastTense(action)}`), 400);
  }

  if (message.type === MessageType.SYSTEM) {
    throw AppError.from(new Error(SYSTEM_ACTION_ERROR[action]), 400);
  }
}

export function getMessagePreview(message: Message): string {
  if (message.text) {
    return message.text.substring(0, 100);
  }

  switch (message.type) {
    case MessageType.IMAGE:
      return "Image";
    case MessageType.VIDEO:
      return "Video";
    case MessageType.VOICE:
      return "Voice message";
    case MessageType.FILE:
      return "File";
    case MessageType.STICKER:
      return "Sticker";
    case MessageType.GIF:
      return "GIF";
    case MessageType.CALL:
      return getCallPreview(message);
    case MessageType.SYSTEM:
      return "System message";
    case MessageType.LINK:
      return "Link";
    default:
      return "Message";
  }
}

export function getForwardedMessageType(message: Message): MessageType {
  if (
    message.type === MessageType.TEXT &&
    extractLinks(message.text || "").length > 0
  ) {
    return MessageType.LINK;
  }
  return message.type;
}

export function extractLinks(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(https?:\/\/[^\s]+)/g);
  return matches || [];
}

export function classificationTypeForMediaType(
  mediaType: MediaType | string,
): ClassificationType {
  if (mediaType === MediaType.IMAGE || mediaType === "image") {
    return ClassificationType.IMAGE;
  }
  if (mediaType === MediaType.VIDEO || mediaType === "video") {
    return ClassificationType.VIDEO;
  }
  if (mediaType === MediaType.AUDIO || mediaType === "audio") {
    return ClassificationType.VOICE;
  }
  return ClassificationType.FILE;
}

function getCallPreview(message: Message): string {
  if (message.text) {
    return message.text.substring(0, 100);
  }

  const call = message.call;
  if (!call) {
    return "Call";
  }

  const typeText = call.callType === "video" ? "video" : "voice";
  if (call.status === "completed") {
    return `Completed ${typeText} call`;
  }
  if (call.status === "missed") {
    return `Missed ${typeText} call`;
  }
  if (call.status === "rejected") {
    return "Rejected call";
  }
  return "Cancelled call";
}

function pastTense(action: "forward" | "quote" | "react"): string {
  if (action === "forward") return "forwarded";
  if (action === "quote") return "quoted";
  return "reacted to";
}
