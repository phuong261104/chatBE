import { BatchWriteCommand, DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, getTableName } from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
import { GroupNote, GroupReminder, GroupReminderStatus } from "../../../model";

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
      status: doc.status || GroupReminderStatus.ACTIVE,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    } as GroupReminder;
  }

  protected toItem(reminder: GroupReminder): Record<string, any> {
    return {
      ...reminder,
      remindAt: reminder.remindAt.toISOString(),
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    };
  }

  protected toUpdate(data: Partial<GroupReminder>): Record<string, any> {
    return {
      title: data.title,
      description: data.description ?? undefined,
      remindAt: data.remindAt ? data.remindAt.toISOString() : undefined,
      status: data.status,
    };
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
