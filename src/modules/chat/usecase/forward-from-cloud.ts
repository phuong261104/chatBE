import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import { IMessageCommandRepository } from "../../interface";
import {
  ConversationType,
  MessageType,
  MessageMedia,
  MediaType,
} from "../../model/model";
import { ForwardFromCloudCommand } from "../../model/dto/message-dto";
import { DynamoCloudItemRepository } from "@modules/my-cloud/infras/repository/dynamodb";
import { SendMessageHandler } from "./send-message";

export class ForwardFromCloudHandler implements ICommandHandler<ForwardFromCloudCommand, any> {
  constructor(
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly sendMessageHandler: SendMessageHandler
  ) {}

  async execute(command: ForwardFromCloudCommand): Promise<any> {
    const cloudItemRepo = new DynamoCloudItemRepository();
    const cloudItem = await cloudItemRepo.get(command.cloudItemId);

    if (!cloudItem) {
      throw AppError.from(new Error("Cloud item not found"), 404);
    }

    if (cloudItem.userId !== command.senderId) {
      throw AppError.from(new Error("Unauthorized"), 403);
    }

    const mediaType = this.getMediaType(cloudItem.type as any);
    const media: MessageMedia[] = [{
      url: cloudItem.fileUrl!,
      mediaType,
      name: cloudItem.fileName || cloudItem.title,
      size: cloudItem.fileSize,
      thumbnailUrl: cloudItem.thumbnailUrl,
    }];

    return this.sendMessageHandler.execute({
      conversationId: command.conversationId,
      senderId: command.senderId,
      text: cloudItem.title,
      media,
    });
  }

  private getMediaType(type: string): MediaType {
    switch (type) {
      case "image":
        return MediaType.IMAGE;
      case "video":
        return MediaType.VIDEO;
      case "voice":
        return MediaType.AUDIO;
      default:
        return MediaType.FILE;
    }
  }
}
