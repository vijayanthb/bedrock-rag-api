import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnswerPrompt } from "../src/lib/prompt.js";
import type { ScoredChunk } from "../src/lib/types.js";

test("includes an explicit 'no context found' instruction when there are no chunks", () => {
  const prompt = buildAnswerPrompt("What is the refund policy?", []);
  assert.match(prompt, /No relevant context was found/);
  assert.match(prompt, /What is the refund policy\?/);
});

test("includes chunk text and source labels when context exists", () => {
  const chunks: ScoredChunk[] = [
    { id: "1", documentId: "policy.txt", text: "Refunds are available within 30 days.", embedding: [], score: 0.9 },
    { id: "2", documentId: "faq.txt", text: "Contact support for exceptions.", embedding: [], score: 0.7 },
  ];
  const prompt = buildAnswerPrompt("What is the refund policy?", chunks);

  assert.match(prompt, /\[1\]/);
  assert.match(prompt, /\[2\]/);
  assert.match(prompt, /policy\.txt/);
  assert.match(prompt, /faq\.txt/);
  assert.match(prompt, /Refunds are available within 30 days\./);
  assert.match(prompt, /Contact support for exceptions\./);
  assert.match(prompt, /What is the refund policy\?/);
});

test("instructs the model not to fabricate answers outside the context", () => {
  const chunks: ScoredChunk[] = [
    { id: "1", documentId: "doc.txt", text: "Some fact.", embedding: [], score: 0.5 },
  ];
  const prompt = buildAnswerPrompt("Unrelated question?", chunks);
  assert.match(prompt, /doesn't contain the answer/);
});
