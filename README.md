# RafaBot portfolio server

RafaBot is the backend for the chatbot on Rafa's portfolio. The current version
uses retrieval-augmented generation (RAG) to find relevant portfolio information
in Supabase and provide it to OpenAI before generating an answer.

## Learn the current RAG pipeline

Start with [Current RAG flow](docs/rag-current-flow.md). It explains ingestion,
embeddings, retrieval, augmentation, generation, the current module boundaries,
and the known limitations we will improve incrementally.

## Local setup

Requirements:

- Node.js 22.12 or newer
- An OpenAI API key
- A Supabase project containing the current vector table and
  `match_documents` function
- A Pinecone API key for the optional RAG v2 synchronization and evaluation

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

The new Pinecone path is available for synchronization, manual search, and
retrieval evaluation while the public chat API continues using Supabase:

```bash
npm run pinecone:sync
npm run pinecone:search -- --locale=en "What has Rafa built?"
npm run evals:retrieval
```

See [Pinecone RAG v2](docs/pinecone-rag-v2.md) for the data flow, configuration,
commands, and the reason for evaluating before switching the chatbot.

## Current API

- `POST /api/createEmbedding` creates an embedding for a visitor question.
- `POST /api/findNearestMatch` retrieves portfolio context and generates the
  RafaBot answer.
- `GET /healthz` reports whether the HTTP process is running.

These endpoints remain unchanged during the baseline refactor so the existing
frontend continues to work.
