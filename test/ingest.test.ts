import { test } from "node:test";
import assert from "node:assert/strict";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ingestHandler } from "../src/handlers/ingest.js";
import type { BedrockClientLike } from "../src/lib/bedrock.js";
import type { ChunkStoreLike } from "../src/lib/dynamo.js";
import type { Chunk } from "../src/lib/types.js";

// Fake implementations standing in for the real AWS SDK clients. This keeps
// the handler tests fast, deterministic, and free of any network/AWS
// dependency, while still exercising the real orchestration logic in
// ingestHandler (parsing, chunking, calling embed per chunk, storing).
function fakeBedrock(): BedrockClientLike {
  return {
    embed: async (text: string) => [text.length, 0, 0], // deterministic fake vector
    generate: async () => "unused in ingest tests",
  };
}

function fakeStore(): ChunkStoreLike & { saved: Chunk[] } {
  const saved: Chunk[] = [];
  return {
    saved,
    putChunk: async (chunk) => {
      saved.push(chunk);
    },
    getChunksForDocument: async (documentId) => saved.filter((c) => c.documentId === documentId),
    getAllChunks: async () => saved,
  };
}

function makeEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}

test("rejects a request with no text", async () => {
  const result = await ingestHandler(makeEvent({}), { bedrock: fakeBedrock(), store: fakeStore() });
  assert.equal(result.statusCode, 400);
});

test("rejects invalid JSON body", async () => {
  const event = { body: "{not json" } as APIGatewayProxyEventV2;
  const result = await ingestHandler(event, { bedrock: fakeBedrock(), store: fakeStore() });
  assert.equal(result.statusCode, 400);
});

test("chunks the document, embeds each chunk, and stores them", async () => {
  const store = fakeStore();
  const text = "a".repeat(2500); // long enough to split into multiple chunks

  const result = await ingestHandler(makeEvent({ documentId: "doc-1", text }), {
    bedrock: fakeBedrock(),
    store,
  });

  assert.equal(result.statusCode, 201);
  const responseBody = JSON.parse(result.body as string);
  assert.equal(responseBody.documentId, "doc-1");
  assert.ok(responseBody.chunkCount > 1);

  // every stored chunk belongs to the right document and has an embedding
  assert.equal(store.saved.length, responseBody.chunkCount);
  for (const chunk of store.saved) {
    assert.equal(chunk.documentId, "doc-1");
    assert.ok(chunk.embedding.length > 0);
  }
});

test("generates a documentId when none is provided", async () => {
  const store = fakeStore();
  const result = await ingestHandler(makeEvent({ text: "A short document." }), {
    bedrock: fakeBedrock(),
    store,
  });

  assert.equal(result.statusCode, 201);
  const responseBody = JSON.parse(result.body as string);
  assert.ok(responseBody.documentId.length > 0);
  assert.equal(store.saved[0].documentId, responseBody.documentId);
});
