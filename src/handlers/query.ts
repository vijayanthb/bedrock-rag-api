import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { topKChunks } from "../lib/similarity.js";
import { buildAnswerPrompt } from "../lib/prompt.js";
import type { BedrockClientLike } from "../lib/bedrock.js";
import type { ChunkStoreLike } from "../lib/dynamo.js";

export interface QueryDeps {
  bedrock: BedrockClientLike;
  store: ChunkStoreLike;
}

interface QueryRequestBody {
  question?: string;
  topK?: number;
}

const DEFAULT_TOP_K = 4;

export async function queryHandler(
  event: APIGatewayProxyEventV2,
  deps: QueryDeps
): Promise<APIGatewayProxyStructuredResultV2> {
  let body: QueryRequestBody;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  if (!body.question || typeof body.question !== "string" || body.question.trim().length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "question is required" }) };
  }

  const topK = body.topK && body.topK > 0 ? body.topK : DEFAULT_TOP_K;

  const allChunks = await deps.store.getAllChunks();
  if (allChunks.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        answer: "No documents have been ingested yet, so there's nothing to search.",
        sources: [],
      }),
    };
  }

  const questionEmbedding = await deps.bedrock.embed(body.question);
  const relevant = topKChunks(questionEmbedding, allChunks, topK);
  const prompt = buildAnswerPrompt(body.question, relevant);
  const answer = await deps.bedrock.generate(prompt);

  return {
    statusCode: 200,
    body: JSON.stringify({
      answer,
      sources: relevant.map((c) => ({ documentId: c.documentId, score: c.score, text: c.text })),
    }),
  };
}
