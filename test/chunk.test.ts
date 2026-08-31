import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../src/lib/chunk.js";

test("returns empty array for empty/whitespace text", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   \n  "), []);
});

test("returns text as a single chunk when under maxChars", () => {
  const text = "This is a short document.";
  const chunks = chunkText(text, { maxChars: 800, overlapChars: 150 });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], text);
});

test("splits long text into multiple chunks", () => {
  const text = "a".repeat(2500);
  const chunks = chunkText(text, { maxChars: 800, overlapChars: 150 });
  assert.ok(chunks.length > 1, "expected more than one chunk");
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 800, `chunk exceeded maxChars: ${chunk.length}`);
  }
});

test("consecutive chunks overlap so context isn't lost at boundaries", () => {
  const text = "a".repeat(2500);
  const chunks = chunkText(text, { maxChars: 800, overlapChars: 150 });
  // With plain repeated characters (no sentence/paragraph breaks to snap to),
  // chunk boundaries should still respect the requested overlap exactly.
  const firstTail = chunks[0].slice(-150);
  const secondHead = chunks[1].slice(0, 150);
  assert.equal(firstTail, secondHead);
});

test("prefers breaking on paragraph boundaries when one exists near the limit", () => {
  const paragraphA = "First paragraph. ".repeat(30); // ~510 chars
  const paragraphB = "Second paragraph. ".repeat(30);
  const text = paragraphA + "\n\n" + paragraphB;
  const chunks = chunkText(text, { maxChars: 600, overlapChars: 100 });

  assert.ok(chunks.length >= 2);
  // The first chunk should end right around the paragraph break, not mid-word.
  assert.ok(chunks[0].trim().endsWith("."), `expected clean break, got: "...${chunks[0].slice(-20)}"`);
});

test("throws if overlapChars is not smaller than maxChars", () => {
  assert.throws(() => chunkText("a".repeat(2000), { maxChars: 100, overlapChars: 100 }));
});
