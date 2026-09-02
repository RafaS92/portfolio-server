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
- `src/platform` owns configuration, provider clients, logging, timeouts, and
  server lifecycle support.
- `src/http` configures Express and owns routes, request middleware, safe
  errors, rate limiting, and readiness.
- `src/chat` validates requests, plans retrieval, coordinates answers, and
  builds the grounded OpenAI input.
- `src/portfolio` loads canonical content, creates localized chunks, and owns
  Pinecone synchronization, search, record mapping, and reranking.
- `src/evaluation` owns offline retrieval, answer, conversation, and
  groundedness evaluation behavior; the production server does not import it.
- `scripts/runtime.js` explicitly assembles the dependencies required by live
  Pinecone and OpenAI commands.

The allowed production dependency direction is
`http -> chat -> portfolio -> platform`. See `docs/ARCHITECTURE.md` for the full
boundary and extension rules.
