import { Block } from "@modules/blocks/model/model";
import { BlockCondDTO, BlockUpdateDTO } from "@modules/blocks/model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { PutCommand, QueryCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
class DynamoBlockQueryRepository extends BaseQueryRepositoryDynamoDB<
  Block,
  BlockCondDTO,
  typeof TABLE_NAMES.BLOCKS
> {
  constructor() {
    super(TABLE_NAMES.BLOCKS, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): Block {
    const { pk, sk, ...rest } = doc;
    return { ...rest } as Block;
  }

  protected buildFilterExpression(cond: BlockCondDTO): string {
    const conditions: string[] = [];
    if (cond.blockerId) conditions.push("blockerId = :blockerId");
    if (cond.blockedUserId) conditions.push("blockedUserId = :blockedUserId");
    return conditions.join(" AND ");
  }

  protected buildAttributeValues(cond: BlockCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.blockerId) values[":blockerId"] = cond.blockerId;
    if (cond.blockedUserId) values[":blockedUserId"] = cond.blockedUserId;
    return values;
  }

  protected buildKeyCondition(_cond: BlockCondDTO): string | undefined {
    if (_cond.blockerId) {
      return "blockerId = :blockerId";
    }
    if (_cond.blockedUserId) {
      return "blockedUserId = :blockedUserId";
    }
    return undefined;
  }

  async list(cond: BlockCondDTO, paging: any): Promise<Block[]> {
    const docClient = getDocClient();
    if (cond.blockerId) {
      const result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.BLOCKS),
          KeyConditionExpression: "blockerId = :blockerId",
          ExpressionAttributeValues: { ":blockerId": cond.blockerId },
          Limit: paging.limit || 50,
        }),
      );
      return (result.Items || []).map((item) => this.toEntity(item));
    }
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.BLOCKS),
        FilterExpression: this.buildFilterExpression(cond),
        ExpressionAttributeValues: this.buildAttributeValues(cond),
        Limit: paging.limit || 50,
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async findAllByCond(cond: BlockCondDTO): Promise<Block[]> {
    const docClient = getDocClient();
    if (cond.blockerId) {
      const result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.BLOCKS),
          KeyConditionExpression: "blockerId = :blockerId",
          ExpressionAttributeValues: { ":blockerId": cond.blockerId },
        }),
      );
      return (result.Items || []).map((item) => this.toEntity(item));
    }
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.BLOCKS),
        FilterExpression: cond.blockedUserId ? "blockedUserId = :blockedUserId" : undefined,
        ExpressionAttributeValues: cond.blockedUserId ? { ":blockedUserId": cond.blockedUserId } : {},
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }
}

class DynamoBlockCommandRepository extends BaseCommandRepositoryDynamoDB<
  Block,
  BlockUpdateDTO,
  typeof TABLE_NAMES.BLOCKS
> {
  constructor() {
    super(TABLE_NAMES.BLOCKS, true);
  }

  protected beforeInsert(data: Block): Record<string, any> {
    const d = data as any;
    const now = new Date().toISOString();
    return {
      id: d.id,
      blockerId: d.blockerId,
      blockedUserId: d.blockedUserId,
      createdAt: d.createdAt ? d.createdAt.toISOString() : now,
    };
  }

  protected beforeUpdate(id: string, data: BlockUpdateDTO): Record<string, any> {
    return {};
  }

  async deleteByCondition(blockerId: string, blockedUserId: string): Promise<boolean> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(TABLE_NAMES.BLOCKS),
        Key: { blockerId, blockedUserId },
      }),
    );
    return true;
  }
}

export class DynamoBlockRepository extends BaseRepositoryDynamoDB<
  Block,
  BlockCondDTO,
  BlockUpdateDTO,
  typeof TABLE_NAMES.BLOCKS
> {
  constructor() {
    super(new DynamoBlockQueryRepository(), new DynamoBlockCommandRepository());
  }

  async deleteByCondition(cond: BlockCondDTO): Promise<boolean> {
    if (cond.blockerId && cond.blockedUserId) {
      return (this.cmdRepo as DynamoBlockCommandRepository).deleteByCondition(cond.blockerId, cond.blockedUserId);
    }
    return false;
  }

  async findAllByCond(cond: BlockCondDTO): Promise<Block[]> {
    return (this.queryRepo as DynamoBlockQueryRepository).findAllByCond(cond);
  }
}
