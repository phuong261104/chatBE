import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IMessageClassificationRepository,
} from "../interface";
import {
  ConversationType,
  ConversationMemberRole,
} from "../model/model";

export class DissolveGroupHandler implements ICommandHandler<{ groupId: string; requesterId: string }, void> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly classificationRepo: IMessageClassificationRepository,
  ) {}

  async execute(command: { groupId: string; requesterId: string }): Promise<void> {
    const { groupId, requesterId } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations can be dissolved"), 400);
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: requesterId,
    });

    if (!requesterMember || requesterMember.leftAt) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const currentOwnerId = conversation.ownerId || conversation.createdBy;
    if (requesterMember.userId !== currentOwnerId && requesterMember.role !== ConversationMemberRole.ADMIN) {
      throw AppError.from(new Error("Only group owner or admin can dissolve the group"), 403);
    }

    const members = await this.conversationMemberQueryRepo.listByConversationId(groupId);

    for (const member of members) {
      await this.conversationMemberCommandRepo.delete(member.id, true);
    }

    const messages = await this.conversationMemberQueryRepo.listByConversationId(groupId);

    const messageRepo = this.messageCommandRepo as any;
    if (messageRepo.findPinnedMessages) {
      const pinnedMessages = await (this.messageCommandRepo as any).findPinnedMessages(groupId);
      for (const msg of pinnedMessages) {
        await this.messageCommandRepo.delete(msg.id, true);
      }
    }

    const deleteAllMessages = async () => {
      const docClient = (await import("@share/repository/dynamodb/client")).getDocClient();
      const { TABLE_NAMES } = await import("@share/repository/dynamodb/table-defs");
      const { QueryCommand, DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
      const { getTableName } = await import("@share/repository/dynamodb/client");

      let lastEvaluatedKey: Record<string, any> | undefined;
      do {
        const result = await docClient.send(
          new QueryCommand({
            TableName: getTableName(TABLE_NAMES.MESSAGES),
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: {
              ":pk": `CONV#${groupId}`,
            },
            ExclusiveStartKey: lastEvaluatedKey,
          }),
        );

        for (const item of result.Items || []) {
          await this.classificationRepo.deleteByMessageId(item.id);
          await docClient.send(
            new DeleteCommand({
              TableName: getTableName(TABLE_NAMES.MESSAGES),
              Key: { pk: item.pk, sk: item.sk },
            }),
          );
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    };

    await deleteAllMessages();

    await this.conversationCommandRepo.delete(groupId, true);
  }
}
