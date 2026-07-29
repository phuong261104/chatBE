import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
} from "../interface";
import { GetDraftsDTO, Draft } from "../model/dto/draft-dto";
import {
  getDocClient,
  getTableName,
} from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export class GetDraftsQueryHandler
  implements IQueryHandler<GetDraftsDTO, { drafts: Draft[] }>
{
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: GetDraftsDTO): Promise<{ drafts: Draft[] }> {
    const { conversationId, userId } = query;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.DRAFTS);

    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}#USER#${userId}`,
          ":skPrefix": "DRAFT#",
        },
        ScanIndexForward: false,
      }),
    );

    const drafts: Draft[] = (result.Items || []).map((item) => ({
      id: item.id,
      conversationId,
      userId,
      text: item.text || "",
      media: item.media || [],
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    }));

    return { drafts };
  }
}
