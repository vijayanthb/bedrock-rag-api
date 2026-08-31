import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { chunkText } from "../lib/chunk.js";
import type { BedrockClientLike } from "../lib/bedrock.js";
import type { ChunkStoreLike } from "../lib/dynamo.js";

export interface IngestDeps {
  bedrock: BedrockClientLike;
  store: ChunkStoreLike;
}

interface IngestRequestBody {
  documentId?: string;
  text?: string;
}

export async function ingestHandler(
  event: APIGatewayProxyEventV2,
  deps: IngestDeps
): Promise<APIGatewayProxyStructuredResultV2> {
  let body: IngestRequestBody;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "text is required" }) };
  }

  const documentId = body.documentId?.trim() || randomUUID();
  const pieces = chunkText(body.text);

  if (pieces.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "text produced no chunks" }) };
  }

  const chunks = await Promise.all(
    pieces.map(async (text) => {
      const embedding = await deps.bedrock.embed(text);
      return { id: randomUUID(), documentId, text, embedding };
    })
  );

  await Promise.all(chunks.map((chunk) => deps.store.putChunk(chunk)));

  return {
    statusCode: 201,
    body: JSON.stringify({ documentId, chunkCount: chunks.length }),
  };
}
