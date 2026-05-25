import { Block } from "@modules/blocks/model/model";
import { BlockCondDTO, BlockCursorPage, BlockUpdateDTO } from "@modules/blocks/model/dto";
import { IBlockRepository } from "@modules/blocks/interface";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { PagingDTO } from "@share/model/paging";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { QueryCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
class DynamoBlockQueryRepository extends BaseQueryRepositoryDynamoDB<Block, BlockCondDTO, typeof TABLE_NAMES.BLOCKS> {
  constructor() {
    super(TABLE_NAMES.BLOCKS, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, unknown>): Block {
    const { pk, sk, ...rest } = doc;
    return { ...rest } as Block;
  }

  protected buildFilterExpression(cond: BlockCondDTO): string | undefined {
    const conditions: string[] = [];
    if (cond.blockerId) conditions.push("#blockerId = :blockerId");
    if (cond.blockedUserId) conditions.push("#blockedUserId = :blockedUserId");
    return conditions.length > 0 ? conditions.join(" AND ") : undefined;
  }

  protected buildAttributeNames(_cond: BlockCondDTO): Record<string, string> {
    return { "#blockerId": "blockerId", "#blockedUserId": "blockedUserId" };
  }

  protected buildAttributeValues(cond: BlockCondDTO): Record<string, unknown> {
    const values: Record<string, unknown> = {};
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

  async findByCond(cond: BlockCondDTO): Promise<Block | null> {
    if (cond.blockerId && cond.blockedUserId) {
      const docClient = getDocClient();
      const result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.BLOCKS),
          KeyConditionExpression: "blockerId = :blockerId AND blockedUserId = :blockedUserId",
          ExpressionAttributeValues: {
            ":blockerId": cond.blockerId,
            ":blockedUserId": cond.blockedUserId,
          },
        }),
      );
      return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
    }
    return super.findByCond(cond);
  }

  async list(cond: BlockCondDTO, paging: PagingDTO): Promise<Block[]> {
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
    return this.findAllByCondWithCursor(cond, undefined, undefined).then(r => r.items);
  }

  async findAllByCondWithCursor(
    cond: BlockCondDTO,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<BlockCursorPage> {
    const docClient = getDocClient();
    const pageLimit = (limit || 20) + 1;

    if (cond.blockerId) {
      let exclusiveStartKey: Record<string, unknown> | undefined;
      if (cursor) {
        exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      }
      const result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.BLOCKS),
          IndexName: "blockerId-createdAt-index",
          KeyConditionExpression: "blockerId = :blockerId",
          ExpressionAttributeValues: { ":blockerId": cond.blockerId },
          Limit: pageLimit,
          ExclusiveStartKey: exclusiveStartKey,
          ScanIndexForward: false,
        }),
      );
      const items = (result.Items || []).map((item) => this.toEntity(item));
      const hasMore = items.length > (limit || 20);
      const returnItems = hasMore ? items.slice(0, limit || 20) : items;
      let nextCursor = "";
      if (hasMore && result.LastEvaluatedKey) {
        nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
      }
      return { items: returnItems, nextCursor, hasMore };
    }

    let exclusiveStartKey: Record<string, unknown> | undefined;
    if (cursor) {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    }
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.BLOCKS),
        FilterExpression: cond.blockedUserId ? "blockedUserId = :blockedUserId" : undefined,
        ExpressionAttributeValues: cond.blockedUserId ? { ":blockedUserId": cond.blockedUserId } : {},
        Limit: pageLimit,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    const items = (result.Items || []).map((item) => this.toEntity(item));
    const hasMore = items.length > (limit || 20);
    const returnItems = hasMore ? items.slice(0, limit || 20) : items;
    let nextCursor = "";
    if (hasMore && result.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }
    return { items: returnItems, nextCursor, hasMore };
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

  protected beforeInsert(data: Block): Record<string, unknown> {
    const now = new Date().toISOString();
    return {
      id: data.id,
      blockerId: data.blockerId,
      blockedUserId: data.blockedUserId,
      createdAt: data.createdAt ? data.createdAt.toISOString() : now,
    };
  }

  protected beforeUpdate(id: string, data: BlockUpdateDTO): Record<string, unknown> {
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
> implements IBlockRepository {
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

  async findAllByCondWithCursor(
    cond: BlockCondDTO,
    cursor: string | undefined,
    limit: number | undefined,
  ) {
    return (this.queryRepo as DynamoBlockQueryRepository).findAllByCondWithCursor(cond, cursor, limit);
  }
}
