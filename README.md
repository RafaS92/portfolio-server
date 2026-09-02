# RafaBot portfolio server

RafaBot is the backend for the chatbot on Rafa's portfolio. RAG v2 searches
bilingual portfolio chunks in Pinecone and provides the retrieved context to
OpenAI before generating a grounded answer.

## Learn the current RAG pipeline

Start with [Current RAG flow](docs/rag-current-flow.md). It explains ingestion,
embeddings, retrieval, augmentation, generation, the current module boundaries,
and the known limitations we will improve incrementally.

## Local setup

Requirements:

- Node.js 22.12 or newer
- An OpenAI API key
- A Pinecone API key for RAG v2 synchronization and retrieval
- A Supabase project only while the temporary legacy chat endpoints are retained

Copy `.env.example` to `.env` and replace the placeholder values. The server
loads `.env` automatically and reports all missing required variables together.

```bash
npm install
npm start
```

The server runs on `http://localhost:3001` unless `PORT` is configured.

Run the automated tests with:

```bash
npm test
```

Validate the bilingual portfolio source data and inspect the semantic chunks:

```bash
npm run content:validate
npm run chunks:inspect
npm run evals:validate
```

The canonical portfolio knowledge lives in `content/portfolio.json`. Each item
contains semantic sections instead of one large résumé string. The chunking
step creates a separate English and Spanish record for every section and adds
metadata that will later support Pinecone retrieval and filtering.

The retrieval cases in `evals/retrieval.json` define which chunk should answer
representative English and Spanish questions. Once Pinecone is connected, these
cases will measure whether the expected result appears near the top of search.

## Try the Pinecone RAG v2 retrieval

The Pinecone path supports synchronization, manual search, evaluation, and the
new single-request chat API:

```bash
npm run pinecone:sync
npm run pinecone:search -- --locale=en "What has Rafa built?"
npm run evals:retrieval
```

See [Pinecone RAG v2](docs/pinecone-rag-v2.md) for the data flow, configuration,
commands, and the reason for evaluating before switching the chatbot.

## Current API

- `POST /api/chat` retrieves Pinecone context and generates a grounded answer.
- `POST /api/createEmbedding` creates an embedding for a visitor question.
- `POST /api/findNearestMatch` retrieves portfolio context and generates the
  RafaBot answer.
- `GET /healthz` reports whether the HTTP process is running.

The portfolio frontend now uses only `POST /api/chat`. The last two POST
endpoints remain temporarily as a rollback path until the deployed frontend is
verified. See [RAG v2 chat API](docs/rag-v2-chat-api.md) for the request,
response, conversation history, and interactive source metadata contract.
