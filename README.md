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

Run the deterministic answer checks after meaningful RAG changes:

```bash
npm run evals:answers:validate
npm run evals:answers
```

The optional groundedness judge evaluates 10 high-risk English and Spanish
answers for unsupported claims, correctness, relevance, and completeness:

```bash
npm run evals:answers:judge
```

The judge command makes 10 normal chatbot generation requests and 10 additional
OpenAI grading requests. It is intended for release checks, not normal server
startup or production chat traffic. `OPENAI_EVAL_MODEL` can select a separate
grader model; by default it uses `OPENAI_MODEL`.

Run the multi-turn conversation checks after changing history handling,
follow-up resolution, retrieval, or prompts:

```bash
npm run evals:conversation:validate
npm run evals:conversation
```

To rerun only one failed scenario and avoid unnecessary API usage:

```bash
npm run evals:conversation -- prompt-injection-es
```

The suite runs 10 conversations containing 25 total turns. It checks pronoun
follow-ups, deliberate topic changes, English/Spanish switching, unsupported
questions, prompt injection, and the 10-message history limit. It uses the same
`message`, `locale`, and explicit `history` contract as `POST /api/chat`; the
command is manual and does not add grading requests to production traffic. The
default required turn pass rate is 90%, configurable with
`EVAL_MIN_CONVERSATION_TURN_PASS_RATE`.

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
