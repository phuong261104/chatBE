import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IConversationMemberQueryRepository } from "../interface";
import { DeleteDraftDTO } from "../model/dto/draft-dto";
import { getDocClient } from "@share/repository/dynamodb/client";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";

export class DeleteDraftCommandHandler implements ICommandHandler<DeleteDraftDTO, void> {
  constructor(private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository) {}

  async execute(command: DeleteDraftDTO): Promise<void> {
    const { conversationId, userId } = command;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const docClient = getDocClient();
    const tableName = "DRAFTS";

    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          pk: `CONV#${conversationId}#USER#${userId}`,
          sk: `DRAFT#CURRENT`,
        },
      })
    );
  }
}
