import type { ScoredChunk } from "./types.js";

export function buildAnswerPrompt(question: string, contextChunks: ScoredChunk[]): string {
  if (contextChunks.length === 0) {
    return [
      "You are a helpful assistant. No relevant context was found for the",
      "following question. Say so plainly rather than guessing.",
      "",
      `Question: ${question}`,
    ].join("\n");
  }

  const context = contextChunks
    .map((c, i) => `[${i + 1}] (source: ${c.documentId})\n${c.text}`)
    .join("\n\n");

  return [
    "You are a helpful assistant answering questions using only the context",
    "provided below. If the context doesn't contain the answer, say so",
    "rather than making one up. Cite sources by their [n] number.",
    "",
    "Context:",
    context,
    "",
    `Question: ${question}`,
  ].join("\n");
}
