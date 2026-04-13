import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
} from "@modules/chat/interface";
import { MediaType } from "@modules/chat/model";
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

    if (!member || member.leftAt) {
      throw AppError.from(new Error("Unauthorized: You are not a member of this conversation"), 403);
    }

    const messages = await this.messageQueryRepo.listWithCursor(
      data.conversationId,
      data.cursor,
      data.limit + 1,
      data.userId,
    );

    const hasMore = messages.length > data.limit;
    const returnMessages = hasMore ? messages.slice(0, data.limit) : messages;

    const images: MediaItem[] = [];
    const files: FileItem[] = [];
    const links: LinkItem[] = [];

    for (const msg of returnMessages) {
      if (msg.deletedAt) continue;

      if (msg.media && msg.media.length > 0) {
        for (const media of msg.media) {
          const item = {
            messageId: msg.id,
            url: media.url,
            name: media.name,
            size: media.size,
            width: media.width,
            height: media.height,
            mediaType: media.mediaType,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
          };

          if (data.type === "all" || data.type === "image") {
            if (media.mediaType === MediaType.IMAGE) {
              images.push(item);
            }
          }

          if (data.type === "all" || data.type === "file") {
            if (media.mediaType === MediaType.FILE) {
              files.push({
                messageId: item.messageId,
                url: item.url,
                name: item.name,
                size: item.size,
                mediaType: item.mediaType,
                senderId: item.senderId,
                createdAt: item.createdAt,
              });
            }
          }
        }
      }

      if (data.type === "all" || data.type === "link") {
        if (msg.links && msg.links.length > 0) {
          for (const url of msg.links) {
            links.push({
              messageId: msg.id,
              url,
              senderId: msg.senderId,
              createdAt: msg.createdAt,
            });
          }
        }
      }
    }

    const nextCursor =
      hasMore && returnMessages.length > 0
        ? returnMessages[returnMessages.length - 1].id
        : "";

    return {
      images,
      files,
      links,
      nextCursor,
      hasMore,
    };
  }
}
