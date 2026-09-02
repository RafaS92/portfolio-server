# Current RAG flow

RAG means **retrieval-augmented generation**. Instead of asking a language
model to answer only from what it learned during training, the application
retrieves relevant portfolio information and supplies it as context.

The application has an offline ingestion flow and an online question-answering
flow, both backed by Pinecone.

## Ingestion flow

The canonical knowledge in `content/portfolio.json` contains bilingual,
structured portfolio items and hand-authored semantic sections.

```text
Structured portfolio items
    -> generate localized semantic chunks
    -> create records with searchable metadata
    -> Pinecone embeds and stores each record
```

Run `npm run chunks:inspect` to inspect every chunk locally. Run
`npm run pinecone:sync` to synchronize the current records and remove stale
record IDs from the configured namespace.

## Question-answering flow

```text
Visitor question, locale, and recent history
    -> POST /api/chat
    -> validate and normalize the request
    -> retrieve the best matching Pinecone records
    -> rerank and select grounded portfolio context
    -> OpenAI generates an answer from that context
    -> return the answer and compact source metadata
```

### 1. Retrieval

Pinecone embeds the query with the same integrated model used for portfolio
records. Search filters by locale, retrieves candidate chunks, and reranks them
before selecting the context passed to generation.

### 2. Augmentation

The selected portfolio chunks are clearly separated and added to the model
input alongside the visitor question and recent conversation history.

### 3. Generation

The language model receives instructions to answer only from the retrieved
context, use the requested language, and admit when the portfolio does not
contain the answer. Response storage is disabled.

## Current module map

- `server.js` starts the HTTP server.
- `src/app.js` configures Express, CORS, JSON parsing, and routes.
- `src/config/env.js` loads and validates environment variables.
- `src/lib/clients.js` creates the OpenAI and Pinecone clients.
- `src/routes/chat.js` exposes the single-request chat endpoint.
- `src/routes/health.js` exposes liveness and readiness endpoints.
- `src/services/ragChat.js` coordinates validation, retrieval, and generation.
- `src/services/conversation.js` builds the grounded prompt and answer.
- `src/content/portfolio.js` loads and validates canonical portfolio content.
- `src/rag/chunkPortfolio.js` creates localized chunks and metadata.
- `src/rag/pineconeStore.js` synchronizes, searches, and reranks records.
