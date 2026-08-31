import type { Chunk, ScoredChunk } from "./types.js";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Brute-force top-k retrieval by cosine similarity. Fine for the small
 * per-document chunk counts this API is designed for; a production system
 * with large corpora would swap this for a real vector index (e.g. an
 * ANN index or a managed vector store) behind the same interface.
 */
export function topKChunks(queryEmbedding: number[], chunks: Chunk[], k: number): ScoredChunk[] {
  return chunks
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
