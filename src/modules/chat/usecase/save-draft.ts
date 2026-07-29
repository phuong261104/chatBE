import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IConversationMemberQueryRepository } from "../interface";
import { SaveDraftDTO } from "../model/dto/draft-dto";
import {
  getDocClient,
  getTableName,
} from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v7 as uuidv7 } from "uuid";

export class SaveDraftCommandHandler implements ICommandHandler<SaveDraftDTO, void> {
  constructor(private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository) {}

  async execute(command: SaveDraftDTO): Promise<void> {
    const { conversationId, userId, text, media } = command;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.DRAFTS);
    const now = new Date().toISOString();

    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: `CONV#${conversationId}#USER#${userId}`,
          sk: `DRAFT#CURRENT`,
          id: uuidv7(),
          conversationId,
          userId,
          text: text || "",
          media: media || [],
          createdAt: now,
          updatedAt: now,
        },
      })
    );
  }
}
