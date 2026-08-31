import { test } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity, topKChunks } from "../src/lib/similarity.js";
import type { Chunk } from "../src/lib/types.js";

test("cosineSimilarity of identical vectors is 1", () => {
  const v = [1, 2, 3];
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-9);
});

test("cosineSimilarity of orthogonal vectors is 0", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
});

test("cosineSimilarity of opposite vectors is -1", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2], [-1, -2]) - -1) < 1e-9);
});

test("cosineSimilarity throws on mismatched vector lengths", () => {
  assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]));
});

test("cosineSimilarity handles zero vectors without dividing by zero", () => {
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

function makeChunk(id: string, embedding: number[]): Chunk {
  return { id, documentId: "doc-1", text: `chunk ${id}`, embedding };
}

test("topKChunks returns the k most similar chunks, sorted descending by score", () => {
  const chunks = [
    makeChunk("a", [1, 0]), // identical to query -> score 1
    makeChunk("b", [0, 1]), // orthogonal -> score 0
    makeChunk("c", [0.9, 0.1]), // close to query -> high score
  ];
  const results = topKChunks([1, 0], chunks, 2);

  assert.equal(results.length, 2);
  assert.equal(results[0].id, "a");
  assert.equal(results[1].id, "c");
  assert.ok(results[0].score >= results[1].score);
});

test("topKChunks returns fewer results than k if not enough chunks exist", () => {
  const chunks = [makeChunk("a", [1, 0])];
  const results = topKChunks([1, 0], chunks, 5);
  assert.equal(results.length, 1);
});

test("topKChunks returns empty array for empty input", () => {
  assert.deepEqual(topKChunks([1, 0], [], 3), []);
});
