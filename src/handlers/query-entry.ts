import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { queryHandler } from "./query.js";
import { BedrockClient } from "../lib/bedrock.js";
import { DynamoChunkStore } from "../lib/dynamo.js";

const bedrock = new BedrockClient();
const store = new DynamoChunkStore(process.env.TABLE_NAME ?? "rag-chunks");

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  return queryHandler(event, { bedrock, store });
}
