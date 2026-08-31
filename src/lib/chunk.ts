export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxChars: 800,
  overlapChars: 150,
};

/**
 * Splits text into overlapping chunks on paragraph/sentence-ish boundaries
 * where possible, falling back to a hard cut at maxChars. Overlap helps
 * avoid losing context that straddles a chunk boundary.
 */
export function chunkText(text: string, options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= options.maxChars) return [trimmed];

  if (options.overlapChars >= options.maxChars) {
    throw new Error("overlapChars must be smaller than maxChars");
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    let end = Math.min(start + options.maxChars, trimmed.length);

    // If we're not at the end of the text, try to break on a paragraph or
    // sentence boundary near `end` rather than mid-word/mid-sentence.
    if (end < trimmed.length) {
      const window = trimmed.slice(start, end);
      const lastParagraph = window.lastIndexOf("\n\n");
      const lastSentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf(".\n"));

      if (lastParagraph > options.maxChars * 0.5) {
        end = start + lastParagraph + 2;
      } else if (lastSentence > options.maxChars * 0.5) {
        end = start + lastSentence + 2;
      }
    }

    chunks.push(trimmed.slice(start, end).trim());

    if (end >= trimmed.length) break;
    start = end - options.overlapChars;
  }

  return chunks.filter((c) => c.length > 0);
}
