import { test } from "node:test";
import assert from "node:assert/strict";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { queryHandler } from "../src/handlers/query.js";
import type { BedrockClientLike } from "../src/lib/bedrock.js";
import type { ChunkStoreLike } from "../src/lib/dynamo.js";
import type { Chunk } from "../src/lib/types.js";

function fakeBedrock(generatedAnswer = "The refund window is 30 days."): BedrockClientLike {
  return {
    // Deterministic fake: embed a question as [1, 0, 0] so it's easy to
    // control which stored chunk it matches most closely in tests.
    embed: async () => [1, 0, 0],
    generate: async () => generatedAnswer,
  };
}

function storeWithChunks(chunks: Chunk[]): ChunkStoreLike {
  return {
    putChunk: async () => {},
    getChunksForDocument: async (documentId) => chunks.filter((c) => c.documentId === documentId),
    getAllChunks: async () => chunks,
  };
}

function makeEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}

test("rejects a request with no question", async () => {
  const result = await queryHandler(makeEvent({}), { bedrock: fakeBedrock(), store: storeWithChunks([]) });
  assert.equal(result.statusCode, 400);
});

test("returns a graceful message when no documents have been ingested", async () => {
  const result = await queryHandler(makeEvent({ question: "What is the policy?" }), {
    bedrock: fakeBedrock(),
    store: storeWithChunks([]),
  });

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body as string);
  assert.match(body.answer, /No documents have been ingested/);
  assert.deepEqual(body.sources, []);
});

test("retrieves the most relevant chunks and returns a grounded answer with sources", async () => {
  const chunks: Chunk[] = [
    { id: "1", documentId: "policy.txt", text: "Refunds within 30 days.", embedding: [1, 0, 0] }, // closest match
    { id: "2", documentId: "faq.txt", text: "Unrelated FAQ content.", embedding: [0, 1, 0] },
  ];

  const result = await queryHandler(makeEvent({ question: "What is the refund policy?", topK: 1 }), {
    bedrock: fakeBedrock("Refunds are available within 30 days. [1]"),
    store: storeWithChunks(chunks),
  });

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body as string);
  assert.equal(body.answer, "Refunds are available within 30 days. [1]");
  assert.equal(body.sources.length, 1);
  assert.equal(body.sources[0].documentId, "policy.txt");
});

test("respects a custom topK value", async () => {
  const chunks: Chunk[] = [
    { id: "1", documentId: "a", text: "chunk a", embedding: [1, 0, 0] },
    { id: "2", documentId: "b", text: "chunk b", embedding: [0.9, 0.1, 0] },
    { id: "3", documentId: "c", text: "chunk c", embedding: [0, 1, 0] },
  ];

  const result = await queryHandler(makeEvent({ question: "test question", topK: 2 }), {
    bedrock: fakeBedrock(),
    store: storeWithChunks(chunks),
  });

  const body = JSON.parse(result.body as string);
  assert.equal(body.sources.length, 2);
});
