import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0";
const GENERATION_MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0";

export interface BedrockClientLike {
  embed(text: string): Promise<number[]>;
  generate(prompt: string): Promise<string>;
}

export class BedrockClient implements BedrockClientLike {
  private client: BedrockRuntimeClient;

  constructor(client: BedrockRuntimeClient = new BedrockRuntimeClient({})) {
    this.client = client;
  }

  async embed(text: string): Promise<number[]> {
    const command = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ inputText: text }),
    });
    const response = await this.client.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    return body.embedding as number[];
  }

  async generate(prompt: string): Promise<string> {
    const command = new InvokeModelCommand({
      modelId: GENERATION_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const response = await this.client.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    return body.content?.[0]?.text ?? "";
  }
}
