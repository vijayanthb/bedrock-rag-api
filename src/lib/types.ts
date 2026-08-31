export interface Chunk {
  id: string;
  documentId: string;
  text: string;
  embedding: number[];
}

export interface ScoredChunk extends Chunk {
  score: number;
}
