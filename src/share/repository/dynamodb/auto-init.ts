import {
  createTableIfNotExists,
  ALL_TABLES,
  TableDefinition,
} from "./table-defs";
import {
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  UpdateTableCommand,
  UpdateTimeToLiveCommand,
  ResourceNotFoundException,
  IndexStatus,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { getDynamoDBClient, getTableName } from "./client";

const client = getDynamoDBClient();

async function waitForDynamoDBReady(
  attempts = 20,
  delayMs = 2000,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await client.send(new ListTablesCommand({ Limit: 1 }));
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(
    `DynamoDB did not become ready after ${attempts} attempts`,
    { cause: lastError },
  );
}

async function waitForIndexActive(
  tableName: string,
  indexName: string,
  maxWaitMs = 60000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const result = await client.send(
      new DescribeTableCommand({ TableName: tableName }),
    );
    const gsi = result.Table?.GlobalSecondaryIndexes?.find(
      (g) => g.IndexName === indexName,
    );
    if (!gsi) {
      throw new Error(`GSI ${indexName} not found on table ${tableName}`);
    }
    if (gsi.IndexStatus === IndexStatus.ACTIVE) {
      return;
    }
    if (gsi.IndexStatus === IndexStatus.DELETING || gsi.IndexStatus === IndexStatus.CREATING) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    break;
  }
  throw new Error(
    `Timeout waiting for GSI ${indexName} on table ${tableName} to become ACTIVE`,
  );
}

async function addMissingGSIsSequentially(
  def: TableDefinition,
): Promise<void> {
  if (!def.GlobalSecondaryIndexes || def.GlobalSecondaryIndexes.length === 0) {
    return;
  }

  try {
    const describeResult = await client.send(
      new DescribeTableCommand({ TableName: def.TableName }),
    );
    const existingGSIs = new Set(
      (describeResult.Table?.GlobalSecondaryIndexes || []).map(
        (gsi) => gsi.IndexName,
      ),
    );
    const existingAttrs = new Set(
      (describeResult.Table?.AttributeDefinitions || []).map(
        (a) => a.AttributeName,
      ),
    );

    for (const gsiDef of def.GlobalSecondaryIndexes) {
      if (existingGSIs.has(gsiDef.IndexName)) {
        console.log(
          `GSI ${gsiDef.IndexName} already exists on table ${def.TableName}.`,
        );
        continue;
      }

      const neededAttrs = gsiDef.KeySchema.map((k) => k.AttributeName);
      const newAttrs = neededAttrs.filter((a) => !existingAttrs.has(a));
      const attrDefs = [
        ...(describeResult.Table?.AttributeDefinitions || []),
        ...newAttrs.map((name) => {
          const attr = def.AttributeDefinitions.find(
            (a) => a.AttributeName === name,
          );
          return (
            attr || { AttributeName: name, AttributeType: "S" as const }
          );
        }),
      ];

      const billingMode = (describeResult.Table as any)?.BillingMode || "PAY_PER_REQUEST";
      const isOnDemand = billingMode === "PAY_PER_REQUEST";

      const gsiCreate: any = {
        IndexName: gsiDef.IndexName,
        KeySchema: gsiDef.KeySchema,
        Projection: gsiDef.Projection,
      };

      if (!isOnDemand && gsiDef.ProvisionedThroughput) {
        gsiCreate.ProvisionedThroughput = gsiDef.ProvisionedThroughput;
      }

      await client.send(
        new UpdateTableCommand({
          TableName: def.TableName,
          AttributeDefinitions: attrDefs as any,
          GlobalSecondaryIndexUpdates: [
            {
              Create: gsiCreate,
            },
          ],
        }),
      );

      console.log(
        `GSI ${gsiDef.IndexName} creation started on table ${def.TableName}. Waiting for ACTIVE...`,
      );

      try {
        await waitForIndexActive(def.TableName, gsiDef.IndexName);
        console.log(
          `GSI ${gsiDef.IndexName} is now ACTIVE on table ${def.TableName}.`,
        );
      } catch (waitErr) {
        console.error(
          `Warning: Could not confirm GSI ${gsiDef.IndexName} status: ${(waitErr as Error).message}`,
        );
      }

      // Refresh existing attributes after creating new ones
      for (const attr of newAttrs) existingAttrs.add(attr);
    }
  } catch (err) {
    if (err instanceof ResourceNotFoundException) {
      return;
    }
    throw new Error(
      `Failed to add GSIs to table ${def.TableName}: ${(err as Error).message}`,
      { cause: err },
    );
  }
}

async function syncTimeToLive(def: TableDefinition): Promise<void> {
  if (!def.TimeToLiveSpecification) {
    return;
  }

  try {
    const current = await client.send(
      new DescribeTimeToLiveCommand({ TableName: def.TableName }),
    );
    const ttlDescription = current.TimeToLiveDescription;
    if (
      ttlDescription?.AttributeName === def.TimeToLiveSpecification.AttributeName &&
      ttlDescription?.TimeToLiveStatus === "ENABLED"
    ) {
      console.log(`TTL already enabled on table ${def.TableName}.`);
      return;
    }

    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: def.TableName,
        TimeToLiveSpecification: def.TimeToLiveSpecification,
      }),
    );
    console.log(
      `TTL sync requested on table ${def.TableName} using ${def.TimeToLiveSpecification.AttributeName}.`,
    );
  } catch (err) {
    if (err instanceof ResourceNotFoundException) {
      return;
    }
    throw new Error(
      `Failed to sync TTL for table ${def.TableName}: ${(err as Error).message}`,
      { cause: err },
    );
  }
}

export async function initDynamoDBTables(): Promise<void> {
  console.log("Initializing DynamoDB tables...");

  await waitForDynamoDBReady();

  const failures: Error[] = [];
  for (const tableDef of ALL_TABLES) {
    const runtimeTableDef: TableDefinition = {
      ...tableDef,
      TableName: getTableName(tableDef.TableName),
    };

    try {
      await createTableIfNotExists(runtimeTableDef);
      await addMissingGSIsSequentially(runtimeTableDef);
      await syncTimeToLive(runtimeTableDef);
    } catch (error) {
      console.error(
        `Failed to initialize table ${runtimeTableDef.TableName}:`,
        error,
      );
      failures.push(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to initialize ${failures.length} DynamoDB table(s)`,
    );
  }

  console.log("DynamoDB tables initialized.");
}
