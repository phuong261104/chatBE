import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "@share/component/config";

let dynamoClient: DynamoDBClient | null = null;
let docClient: DynamoDBDocumentClient | null = null;

function createClient(): DynamoDBClient {
  const isLocal = config.dynamodb.endpoint.includes("localhost") ||
                  config.dynamodb.endpoint.includes("127.0.0.1");

  return new DynamoDBClient({
    region: config.dynamodb.region,
    ...(isLocal ? { endpoint: config.dynamodb.endpoint } : {}),
    credentials: isLocal
      ? { accessKeyId: "local", secretAccessKey: "local" }
      : undefined,
  });
}

export function getDynamoDBClient(): DynamoDBClient {
  if (!dynamoClient) {
    dynamoClient = createClient();
  }
  return dynamoClient;
}

export function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }
  return docClient;
}

export function getTableName(table: string): string {
  return `${config.dynamodb.tablePrefix}${table}`;
}
