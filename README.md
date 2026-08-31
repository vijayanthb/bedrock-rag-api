# bedrock-rag-api

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

A serverless retrieval-augmented generation (RAG) API on AWS. Upload a
document, ask questions about it, get answers grounded in the document's
actual content instead of the model guessing.

## How it works

1. **`POST /documents`** — the document is split into overlapping chunks,
   each chunk is embedded via Amazon Bedrock (Titan Embeddings), and the
   chunks + embeddings are stored in DynamoDB.
2. **`POST /query`** — the question is embedded the same way, compared
   against every stored chunk's embedding (cosine similarity), and the
   most relevant chunks are pulled out and handed to Claude (via Bedrock)
   as context to answer from — with sources cited.

## Architecture

```
API Gateway
  ├─ POST /documents → IngestFunction (Lambda) → Bedrock (embed) → DynamoDB
  └─ POST /query      → QueryFunction  (Lambda) → DynamoDB (retrieve)
                                                  → Bedrock (embed + generate)
```

Infrastructure is defined as code in `template.yaml` (AWS SAM) — a
DynamoDB table (pay-per-request) and two Lambda functions behind API
Gateway, each with least-privilege IAM policies scoped to only what they
need (Dynamo read/write, Bedrock invoke).

## Design notes

- **Retrieval is brute-force cosine similarity** over all stored chunks
  (`src/lib/similarity.ts`). Fine at the small, single-user scale this
  project targets; a production system with a large corpus would swap
  this for a real vector index (e.g. OpenSearch Serverless's vector
  engine, or a managed vector DB) behind the same `topKChunks` interface.
- **Chunking** (`src/lib/chunk.ts`) tries to break on paragraph/sentence
  boundaries near the target size instead of cutting mid-sentence, and
  chunks overlap slightly so context isn't lost right at a boundary.
- **AWS clients are wrapped behind small interfaces**
  (`BedrockClientLike`, `ChunkStoreLike`) and injected into the handlers,
  so the actual orchestration logic (`src/handlers/`) is unit-testable
  with fake in-memory implementations — no AWS account, network access,
  or mocking framework needed to verify the logic is correct.

## Project structure

```
src/
  lib/
    chunk.ts          text chunking (pure function)
    similarity.ts       cosine similarity + top-k retrieval (pure function)
    prompt.ts             builds the grounded-answer prompt (pure function)
    bedrock.ts               thin wrapper around the Bedrock SDK client
    dynamo.ts                   thin wrapper around the DynamoDB SDK client
    types.ts
  handlers/
    ingest.ts          testable handler logic (dependencies injected)
    query.ts            testable handler logic (dependencies injected)
    ingest-entry.ts        real Lambda entry point (wires up real AWS clients)
    query-entry.ts           real Lambda entry point (wires up real AWS clients)
test/
  chunk.test.ts, similarity.test.ts, prompt.test.ts   pure-logic tests
  ingest.test.ts, query.test.ts                         handler tests (fake AWS clients)
template.yaml            AWS SAM infrastructure definition
```

## Running the tests

No AWS account needed — everything below runs entirely locally:

```bash
npm install
npm test
```

## Deploying

Requires an AWS account with Bedrock model access enabled (Titan
Embeddings + Claude 3.5 Sonnet) and the [AWS SAM
CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
installed.

```bash
sam build
sam deploy --guided
```

`sam deploy --guided` walks through picking a stack name/region and
creates the DynamoDB table, both Lambda functions, and the API Gateway
endpoint. The API's base URL is printed as a stack output when it's done.

## Possible next steps

- Swap brute-force retrieval for a real vector index at scale
- Add authentication (API key or IAM auth on API Gateway) before any
  public deployment
- Streaming responses instead of waiting for the full generated answer
- Support PDF/docx ingestion instead of plain text only

## License

MIT
