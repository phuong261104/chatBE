import { createTableIfNotExists, ALL_TABLES } from "./table-defs";

export async function initDynamoDBTables(): Promise<void> {
  console.log("Initializing DynamoDB tables...");

  for (const tableDef of ALL_TABLES) {
    try {
      await createTableIfNotExists(tableDef);
    } catch (error) {
      console.error(`Failed to create table ${tableDef.TableName}:`, error);
    }
  }

  console.log("DynamoDB tables initialized.");
}
