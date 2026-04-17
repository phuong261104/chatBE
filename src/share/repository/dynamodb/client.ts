import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "@share/component/config";

let dynamoClient: DynamoDBClient | null = null;
let docClient: DynamoDBDocumentClient | null = null;

function createClient(): DynamoDBClient {
  const isLocal = config.dynamodb.endpoint.includes("localhost") ||
                  config.dynamodb.endpoint.includes("127.0.0.1");

  if (isLocal) {
    return new DynamoDBClient({
      region: config.dynamodb.region,
      endpoint: config.dynamodb.endpoint,
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    });
  }

  const clientConfig: { region: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = {
    region: config.dynamodb.region,
  };

  if (config.dynamodb.accessKeyId && config.dynamodb.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.dynamodb.accessKeyId,
      secretAccessKey: config.dynamodb.secretAccessKey,
    };
  }

  return new DynamoDBClient(clientConfig);
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
