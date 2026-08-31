import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { Chunk } from "./types.js";

export interface ChunkStoreLike {
  putChunk(chunk: Chunk): Promise<void>;
  getChunksForDocument(documentId: string): Promise<Chunk[]>;
  getAllChunks(): Promise<Chunk[]>;
}

export class DynamoChunkStore implements ChunkStoreLike {
  private doc: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string, client: DynamoDBClient = new DynamoDBClient({})) {
    this.tableName = tableName;
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async putChunk(chunk: Chunk): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: chunk,
      })
    );
  }

  async getChunksForDocument(documentId: string): Promise<Chunk[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "documentId = :documentId",
        ExpressionAttributeValues: { ":documentId": documentId },
      })
    );
    return (result.Items ?? []) as Chunk[];
  }

  /**
   * Fetches every chunk across all documents, for cross-document retrieval.
   * A DynamoDB Scan doesn't paginate automatically past 1MB, and isn't
   * efficient at real scale — fine for a small portfolio-sized corpus; a
   * production version would use a proper vector index instead of brute
   * force over a full table scan.
   */
  async getAllChunks(): Promise<Chunk[]> {
    const result = await this.doc.send(new ScanCommand({ TableName: this.tableName }));
    return (result.Items ?? []) as Chunk[];
  }
}
