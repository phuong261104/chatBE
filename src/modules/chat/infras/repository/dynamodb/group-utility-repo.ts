import { BatchWriteCommand, DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, getTableName } from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
import { GroupNote, GroupReminder, GroupReminderRepeatRule, GroupReminderStatus } from "../../../model";

function definedEntries(data: Record<string, any>) {
  return Object.entries(data).filter(([, value]) => value !== undefined);
}

abstract class ConversationIndexedRepository<T extends { id: string; conversationId: string }> {
  protected readonly docClient = getDocClient();

  constructor(protected readonly tableNameKey: keyof typeof TABLE_NAMES) {}

  protected get tableName() {
    return getTableName(TABLE_NAMES[this.tableNameKey]);
  }

  protected abstract toEntity(doc: Record<string, any>): T;
  protected abstract toItem(entity: T): Record<string, any>;
  protected abstract toUpdate(data: Partial<T>): Record<string, any>;

  async get(id: string): Promise<T | null> {
    const result = await this.docClient.send(new GetCommand({ TableName: this.tableName, Key: { id } }));
    return result.Item ? this.toEntity(result.Item) : null;
  }

  async findByConversationId(conversationId: string): Promise<T[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "conversation-index",
        KeyConditionExpression: "conversationId = :conversationId",
        ExpressionAttributeValues: { ":conversationId": conversationId },
        Limit: 100,
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async insert(entity: T): Promise<boolean> {
    await this.docClient.send(new PutCommand({ TableName: this.tableName, Item: this.toItem(entity) }));
    return true;
  }

  async update(id: string, data: Partial<T>): Promise<boolean> {
    const updateData = this.toUpdate(data);
    const entries = definedEntries({ ...updateData, updatedAt: new Date().toISOString() });
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(", ")}`,
        ExpressionAttributeNames: Object.fromEntries(entries.map(([key]) => [`#${key}`, key])),
        ExpressionAttributeValues: Object.fromEntries(entries.map(([key, value]) => [`:${key}`, value])),
      }),
    );
    return true;
  }

  protected async conditionalUpdate(
    id: string,
    data: Partial<T>,
    conditionExpression: string,
    conditionNames: Record<string, string>,
    conditionValues: Record<string, any>,
  ): Promise<boolean> {
    const entries = definedEntries({ ...this.toUpdate(data), updatedAt: new Date().toISOString() });
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          UpdateExpression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(", ")}`,
          ConditionExpression: conditionExpression,
          ExpressionAttributeNames: {
            ...Object.fromEntries(entries.map(([key]) => [`#${key}`, key])),
            ...conditionNames,
          },
          ExpressionAttributeValues: {
            ...Object.fromEntries(entries.map(([key, value]) => [`:${key}`, value])),
            ...conditionValues,
          },
        }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        return false;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.docClient.send(new DeleteCommand({ TableName: this.tableName, Key: { id } }));
    return true;
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    const items = await this.findByConversationId(conversationId);
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      if (chunk.length === 0) continue;
      await this.docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map((item) => ({ DeleteRequest: { Key: { id: item.id } } })),
          },
        }),
      );
    }
  }
}

class GroupReminderBaseRepository extends ConversationIndexedRepository<GroupReminder> {
  constructor() {
    super("GROUP_REMINDERS");
  }

  protected toEntity(doc: Record<string, any>): GroupReminder {
    return {
      ...doc,
      remindAt: doc.remindAt ? new Date(doc.remindAt) : new Date(),
      repeatRule: doc.repeatRule || GroupReminderRepeatRule.NONE,
      notifyBeforeMinutes: doc.notifyBeforeMinutes || 0,
      nextNotifyAt: doc.nextNotifyAt ? new Date(doc.nextNotifyAt) : undefined,
      lastNotifiedAt: doc.lastNotifiedAt ? new Date(doc.lastNotifiedAt) : undefined,
      status: doc.status || GroupReminderStatus.ACTIVE,
      pinned: doc.pinned || false,
      pinnedAt: doc.pinnedAt ? new Date(doc.pinnedAt) : undefined,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    } as GroupReminder;
  }

  protected toItem(reminder: GroupReminder): Record<string, any> {
    return {
      ...reminder,
      remindAt: reminder.remindAt.toISOString(),
      repeatRule: reminder.repeatRule || GroupReminderRepeatRule.NONE,
      notifyBeforeMinutes: reminder.notifyBeforeMinutes || 0,
      nextNotifyAt: reminder.nextNotifyAt ? reminder.nextNotifyAt.toISOString() : reminder.remindAt.toISOString(),
      lastNotifiedAt: reminder.lastNotifiedAt ? reminder.lastNotifiedAt.toISOString() : undefined,
      pinned: reminder.pinned || false,
      pinnedAt: reminder.pinnedAt ? reminder.pinnedAt.toISOString() : undefined,
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    };
  }

  protected toUpdate(data: Partial<GroupReminder>): Record<string, any> {
    return {
      title: data.title,
      description: data.description ?? undefined,
      remindAt: data.remindAt ? data.remindAt.toISOString() : undefined,
      repeatRule: data.repeatRule,
      notifyBeforeMinutes: data.notifyBeforeMinutes,
      nextNotifyAt: data.nextNotifyAt ? data.nextNotifyAt.toISOString() : undefined,
      lastNotifiedAt: data.lastNotifiedAt ? data.lastNotifiedAt.toISOString() : undefined,
      status: data.status,
      pinned: data.pinned,
      pinnedAt: data.pinnedAt === null ? null : data.pinnedAt ? data.pinnedAt.toISOString() : undefined,
      pinnedBy: data.pinnedBy === null ? null : data.pinnedBy,
    };
  }

  async findDueReminders(nowDate: Date, limit = 100): Promise<GroupReminder[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "status-nextNotifyAt-index",
        KeyConditionExpression: "#status = :status AND nextNotifyAt <= :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": GroupReminderStatus.ACTIVE,
          ":now": nowDate.toISOString(),
        },
        Limit: limit,
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async updateDueReminder(
    id: string,
    expectedNextNotifyAt: Date,
    data: Partial<GroupReminder>,
  ): Promise<boolean> {
    return this.conditionalUpdate(
      id,
      data,
      "#status = :active AND nextNotifyAt = :expectedNextNotifyAt",
      { "#status": "status" },
      {
        ":active": GroupReminderStatus.ACTIVE,
        ":expectedNextNotifyAt": expectedNextNotifyAt.toISOString(),
      },
    );
  }
}

class GroupNoteBaseRepository extends ConversationIndexedRepository<GroupNote> {
  constructor() {
    super("GROUP_NOTES");
  }

  protected toEntity(doc: Record<string, any>): GroupNote {
    return {
      ...doc,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    } as GroupNote;
  }

  protected toItem(note: GroupNote): Record<string, any> {
    return {
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  protected toUpdate(data: Partial<GroupNote>): Record<string, any> {
    return {
      title: data.title,
      content: data.content,
      updatedBy: data.updatedBy,
    };
  }
}

export class DynamoGroupReminderRepository extends GroupReminderBaseRepository {}
export class DynamoGroupNoteRepository extends GroupNoteBaseRepository {}
