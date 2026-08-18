# Current RAG flow

RAG means **retrieval-augmented generation**. Instead of asking a language
model to answer only from what it learned during training, the application
retrieves relevant portfolio information and supplies that information as
context for the answer.

The current application has two connected flows: an offline ingestion flow and
an online question-answering flow.

## Ingestion flow

The canonical knowledge in `content/portfolio.json` contains bilingual,
structured portfolio items and hand-authored semantic sections. The ingestion
script in `embeddings.js` can prepare those sections before visitors use the
chatbot.

```text
Structured portfolio items
    -> generate localized semantic chunks
    -> create one embedding for each chunk with OpenAI
    -> store the chunk and its embedding in Supabase
```

An **embedding** is a list of numbers representing the meaning of some text.
Texts with related meanings usually produce vectors that are close to one
another. Supabase stores the vectors so they can be searched later.

Run `npm run chunks:inspect` to see every chunk before it is embedded. The
current `embeddings.js` remains a legacy Supabase helper and is not executed
automatically; a later learning step will replace it with Pinecone ingestion.

## Question-answering flow

```text
Visitor question
    -> POST /api/createEmbedding
    -> OpenAI converts the question to an embedding
    -> frontend sends the embedding and question to /api/findNearestMatch
    -> Supabase compares the question vector with stored document vectors
    -> the closest matching document becomes context
    -> OpenAI receives the context and original question
    -> RafaBot's grounded answer is returned to the frontend
```

### 1. Retrieval

`POST /api/createEmbedding` converts the visitor's question into a vector using
the same embedding model that was used for the stored portfolio content.

`POST /api/findNearestMatch` calls the Supabase `match_documents` database
function. It requests one result with a similarity threshold of `0.5`.

Using the same embedding model for documents and questions is essential. Vector
dimensions alone are not enough; vectors created by different models do not
share a comparable semantic space.

### 2. Augmentation

The matching portfolio text is added to the user message as `Context`. This is
the "augmented" part of retrieval-augmented generation.

### 3. Generation

The language model receives the system instructions, retrieved context, and
visitor question. The system instructions tell RafaBot to stay grounded in the
provided context and admit when the answer is not available.

## Current module map

- `server.js` starts the HTTP server.
- `src/app.js` configures Express, CORS, JSON parsing, and routes.
- `src/config/env.js` loads and validates environment variables.
- `src/lib/clients.js` creates the OpenAI and Supabase service clients.
- `src/routes/chat.js` contains the two existing HTTP endpoints.
- `src/routes/health.js` contains the process health endpoint.
- `src/services/conversation.js` builds the prompt and generates the answer.
- `src/content/portfolio.js` loads and validates canonical portfolio content.
- `src/rag/chunkPortfolio.js` creates localized semantic chunks and metadata.
- `embeddings.js` contains the legacy Supabase ingestion helper.

## Known limitations intentionally left for later steps

- Conversation history is global and can mix different visitors.
- The browser makes two requests when the backend should own the full RAG flow.
- Retrieval requests only one document and does not handle an empty match.
- Supabase errors are not inspected before reading returned data.
- The currently deployed Supabase data may still contain the previous large
  vector until the index is migrated.
- The embedding model is from an older generation.

These limitations remain visible in this baseline so each subsequent change can
teach and demonstrate one RAG concept at a time.
