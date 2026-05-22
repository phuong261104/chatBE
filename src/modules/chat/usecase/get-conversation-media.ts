import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IMessageClassificationRepository,
  IMessageQueryRepository,
} from "@modules/chat/interface";
import {
  ClassificationType,
  ConversationMemberStatus,
  MediaType,
  MessageStatus,
} from "@modules/chat/model/model";
import {
  GetConversationMediaQuerySchema,
  GetConversationMediaQuery,
  GetConversationMediaResult,
  MediaItem,
  FileItem,
  LinkItem,
} from "@modules/chat/model/dto/media-group-dto";

export class GetConversationMediaQueryHandler
  implements IQueryHandler<GetConversationMediaQuery, GetConversationMediaResult>
{
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly classificationRepo: IMessageClassificationRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
  ) {}

  async query(query: GetConversationMediaQuery): Promise<GetConversationMediaResult> {
    const { success, data, error } = GetConversationMediaQuerySchema.safeParse(query);

    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: data.conversationId,
      userId: data.userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("Unauthorized: You are not a member of this conversation"), 403);
    }

    let result: { items: any[]; nextCursor: string; hasMore: boolean };

    if (data.type === "all") {
      result = await this.classificationRepo.listByConversation(
        data.conversationId,
        data.cursor,
        data.limit + 1,
      );
    } else {
      const typeMap: Record<string, ClassificationType> = {
        image: ClassificationType.IMAGE,
        file: ClassificationType.FILE,
        link: ClassificationType.LINK,
        video: ClassificationType.VIDEO,
        voice: ClassificationType.VOICE,
      };
      const type = typeMap[data.type];
      result = await this.classificationRepo.listByConversationAndType(
        data.conversationId,
        type,
        data.cursor,
        data.limit + 1,
      );
    }

    const hasMore = result.items.length > data.limit;
    const returnItems = hasMore ? result.items.slice(0, data.limit) : result.items;

    const images: MediaItem[] = [];
    const files: FileItem[] = [];
    const links: LinkItem[] = [];

    const nowEpoch = Math.floor(Date.now() / 1000);
    for (const item of returnItems) {
      const message = await this.messageQueryRepo.get(item.messageId);
      if (
        !message ||
        message.messageStatus === MessageStatus.REVOKED ||
        message.deletedAt ||
        message.deletedForUserIds?.includes(data.userId) ||
        (message.expireAtEpoch && message.expireAtEpoch <= nowEpoch)
      ) {
        continue;
      }

      if (item.type === ClassificationType.IMAGE) {
        images.push({
          messageId: item.messageId,
          url: item.url,
          name: item.name,
          size: undefined,
          width: undefined,
          height: undefined,
          mediaType: MediaType.IMAGE,
          senderId: item.senderId,
          createdAt: new Date(item.createdAt),
        });
      } else if (item.type === ClassificationType.FILE) {
        files.push({
          messageId: item.messageId,
          url: item.url,
          name: item.name,
          size: undefined,
          mediaType: MediaType.FILE,
          senderId: item.senderId,
          createdAt: new Date(item.createdAt),
        });
      } else if (item.type === ClassificationType.LINK) {
        links.push({
          messageId: item.messageId,
          url: item.linkUrl,
          senderId: item.senderId,
          createdAt: new Date(item.createdAt),
        });
      } else if (item.type === ClassificationType.VIDEO) {
        images.push({
          messageId: item.messageId,
          url: item.url,
          name: item.name,
          size: undefined,
          width: undefined,
          height: undefined,
          mediaType: MediaType.VIDEO,
          senderId: item.senderId,
          createdAt: new Date(item.createdAt),
        });
      } else if (item.type === ClassificationType.VOICE) {
        files.push({
          messageId: item.messageId,
          url: item.url,
          name: item.name,
          size: undefined,
          mediaType: MediaType.AUDIO,
          senderId: item.senderId,
          createdAt: new Date(item.createdAt),
        });
      }
    }

    return {
      images,
      files,
      links,
      nextCursor: result.nextCursor,
      hasMore,
    };
  }
}
