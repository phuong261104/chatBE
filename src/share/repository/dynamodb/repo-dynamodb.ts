import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { ModelStatus } from "@share/model/base-model";
import { PagingDTO } from "@share/model/paging";
import { IQueryRepository, ICommandRepository, IRepository } from "@share/interface";
import { getDocClient, getTableName } from "./client";

export abstract class BaseQueryRepositoryDynamoDB<
  Entity extends Record<string, any>,
  Cond extends Record<string, any>,
  TableName extends string,
> implements IQueryRepository<Entity, Cond> {
  constructor(
    protected readonly table: TableName,
    protected readonly defaultSort: Record<string, -1 | 1> = { id: -1 },
    protected readonly gsi?: string,
  ) {}

  protected docClient = getDocClient();

  protected abstract toEntity(doc: Record<string, any>): Entity;

  protected getTableName(): string {
    return getTableName(this.table);
  }

  async get(id: string): Promise<Entity | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.getTableName(),
        Key: { id },
      }),
    );
    return result.Item ? this.toEntity(result.Item) : null;
  }

  async findByCond(cond: Cond): Promise<Entity | null> {
    const items = await this.list(cond, { page: 1, limit: 1000 });
    return items && items.length > 0 ? items[0] : null;
  }

  async list(cond: Cond, paging: PagingDTO): Promise<Array<Entity>> {
    const { page, limit } = paging;
    const p = paging as any;
    const exclusiveStartKey = p.cursor ? JSON.parse(Buffer.from(p.cursor, "base64").toString("utf-8")) : undefined;

    const attrNames = this.buildAttributeNames(cond) || {};
    const attrValues = this.buildAttributeValues(cond);
    const filterExpr = this.buildFilterExpression(cond);
    const keyExpr = this.buildKeyCondition(cond);
    const hasAttrNames = Object.keys(attrNames).length > 0;
    const hasFilterExpr = !!filterExpr && filterExpr.length > 0;

    let result;
    if (this.gsi) {
      result = await this.docClient.send(
        new QueryCommand({
          TableName: this.getTableName(),
          IndexName: this.gsi,
          KeyConditionExpression: keyExpr,
          ...(hasFilterExpr ? { FilterExpression: filterExpr } : {}),
          ...(hasAttrNames ? { ExpressionAttributeNames: attrNames } : {}),
          ExpressionAttributeValues: attrValues,
          Limit: limit,
          ExclusiveStartKey: exclusiveStartKey,
          ScanIndexForward: this.defaultSort?.id !== -1,
        }),
      );
    } else {
      result = await this.docClient.send(
        new ScanCommand({
          TableName: this.getTableName(),
          ...(hasFilterExpr ? { FilterExpression: filterExpr } : {}),
          ...(hasAttrNames ? { ExpressionAttributeNames: attrNames } : {}),
          ExpressionAttributeValues: attrValues,
          Limit: limit,
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
    }

    if (result.LastEvaluatedKey) {
      (paging as any).cursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async listByIds(ids: string[]): Promise<Array<Entity>> {
    if (ids.length === 0) return [];
    const keys = ids.map((id) => ({ id }));
    const chunks = this.chunkArray(keys, 100);
    const results: Entity[] = [];

    for (const chunk of chunks) {
      const result = await this.docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [this.getTableName()]: {
              Keys: chunk,
            },
          },
        }),
      );
      if (result.Responses && result.Responses[this.getTableName()]) {
        results.push(...result.Responses[this.getTableName()].map((item) => this.toEntity(item)));
      }
    }

    return results;
  }

  protected buildFilterExpression(_cond: Cond): string | undefined {
    return undefined;
  }

  protected buildKeyCondition(_cond: Cond): string | undefined {
    return undefined;
  }

  protected buildAttributeNames(_cond: Cond): Record<string, string> | undefined {
    return undefined;
  }

  protected buildAttributeValues(_cond: Cond): Record<string, any> {
    return {};
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}

export abstract class BaseCommandRepositoryDynamoDB<
  Entity extends Record<string, any>,
  UpdateDTO extends Record<string, any>,
  TableName extends string,
> implements ICommandRepository<Entity, UpdateDTO> {
  constructor(
    protected readonly table: TableName,
    protected readonly softDelete: boolean = true,
  ) {}

  protected docClient = getDocClient();

  protected abstract beforeInsert(data: Entity): Record<string, any>;
  protected abstract beforeUpdate(id: string, data: UpdateDTO): Record<string, any>;

  protected getTableName(): string {
    return getTableName(this.table);
  }

  async insert(data: Entity): Promise<boolean> {
    const item = this.beforeInsert(data);
    await this.docClient.send(
      new PutCommand({
        TableName: this.getTableName(),
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
    return true;
  }

  async update(id: string, data: UpdateDTO): Promise<boolean> {
    const updateData = this.beforeUpdate(id, data);
    if (Object.keys(updateData).length === 0) return true;

    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    let idx = 0;
    for (const [key, value] of Object.entries(updateData)) {
      const nameKey = `#attr${idx}`;
      const valueKey = `:val${idx}`;
      updateExpressions.push(`${nameKey} = ${valueKey}`);
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[valueKey] = value;
      idx++;
    }

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.getTableName(),
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: "attribute_exists(id)",
      }),
    );
    return true;
  }

  async delete(id: string, isHard: boolean = false): Promise<boolean> {
    if (!isHard && this.softDelete) {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.getTableName(),
          Key: { id },
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": ModelStatus.DELETED },
        }),
      );
    } else {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.getTableName(),
          Key: { id },
        }),
      );
    }
    return true;
  }
}

export abstract class BaseRepositoryDynamoDB<
  Entity extends Record<string, any>,
  Cond extends Record<string, any>,
  UpdateDTO extends Record<string, any>,
  TableName extends string,
> implements IRepository<Entity, Cond, UpdateDTO> {
  constructor(
    readonly queryRepo: BaseQueryRepositoryDynamoDB<Entity, Cond, TableName>,
    readonly cmdRepo: BaseCommandRepositoryDynamoDB<Entity, UpdateDTO, TableName>,
  ) {}

  async get(id: string): Promise<Entity | null> {
    return await this.queryRepo.get(id);
  }

  async findByCond(cond: Cond): Promise<Entity | null> {
    return await this.queryRepo.findByCond(cond);
  }

  async list(cond: Cond, paging: PagingDTO): Promise<Array<Entity>> {
    return await this.queryRepo.list(cond, paging);
  }

  async listByIds(ids: string[]): Promise<Array<Entity>> {
    return await this.queryRepo.listByIds(ids);
  }

  async insert(data: Entity): Promise<boolean> {
    return await this.cmdRepo.insert(data);
  }

  async update(id: string, data: UpdateDTO): Promise<boolean> {
    return await this.cmdRepo.update(id, data);
  }

  async delete(id: string, isHard: boolean): Promise<boolean> {
    return await this.cmdRepo.delete(id, isHard);
  }
}
