# RafaBot portfolio server

RafaBot is the Node.js backend for the chatbot on Rafa's portfolio. It uses a
retrieval-augmented generation (RAG) pipeline to answer questions from a
curated, bilingual portfolio instead of relying on the model's general
knowledge.

The service exposes one stateless chat endpoint. It retrieves English or
Spanish evidence from Pinecone, applies portfolio-specific selection rules,
and asks OpenAI to produce a short answer grounded only in that evidence.

## Technology and design

- Node.js 22 and Express 5
- OpenAI Responses API for answer generation
- Pinecone integrated embeddings and semantic search
- English and Spanish portfolio content
- Dependency-injected, feature-first modular monolith
- Built-in validation, evaluation fixtures, structured logging, request
  protection, readiness checks, and graceful shutdown

## System flow

There are two distinct flows: an offline content synchronization flow and the
online request path.

### 1. Content synchronization

```text
content/portfolio.json
        |
        v
validate bilingual items and semantic sections
        |
        v
create one English and one Spanish chunk per section
        |
        v
map chunks to flat Pinecone records and metadata
        |
        v
upsert current records and delete stale IDs in the configured namespace
```

Pinecone embeds the `chunk_text` field with its integrated
`llama-text-embed-v2` model. Chunk IDs are deterministic:
`<item-id>-<section-id>-<locale>`. Searchable metadata includes the content
type, locale, title, topic, dates, technologies, and tags.

`npm run pinecone:sync` creates the index when necessary and synchronizes the
selected namespace. The index is created in AWS `us-east-1`, with deletion
protection enabled and `locale` configured as a filterable field.

### 2. Chat request

```text
visitor message + locale + recent history
        |
        v
request ID -> logging -> CORS -> JSON limit -> per-IP rate limit
        |
        v
validate and normalize POST /api/chat
        |
        v
plan retrieval -> Pinecone search or a targeted local content selection
        |
        v
rerank and select grounded evidence
        |
        v
OpenAI generates a 2-5 sentence answer in the requested language
        |
        v
return the answer and public source metadata
```

Normal semantic queries retrieve 30 locale-filtered candidates and locally
rerank the best three. Broad project-discovery queries retrieve a wider set and
order up to four projects by the curated `archiveOrder`. A small set of guided
portfolio topics uses the canonical local chunks directly. Follow-up questions
can include the previous user message in the retrieval query, while the full
provided history is passed to generation.

The server does not store conversation state. The client owns the history and
sends the latest messages with every request. OpenAI response storage is also
disabled.

## Repository layout

```text
.
├── server.js                 # Production composition root and process startup
├── content/portfolio.json    # Canonical bilingual portfolio knowledge
├── src/
│   ├── http/                 # Express routes, middleware, health, and errors
│   ├── chat/                 # Request contract, retrieval policy, and generation
│   ├── portfolio/            # Content, chunks, Pinecone records/search, reranking
│   ├── platform/             # Config, clients, logging, timeouts, lifecycle
│   └── evaluation/           # Retrieval, answer, conversation, and judge logic
├── evals/                    # Versioned evaluation cases
├── scripts/                  # Validation, synchronization, evaluation, release CLIs
├── test/                     # Node test runner suite
└── docs/                     # Detailed architecture and RAG notes
```

The production dependency direction is:

```text
http -> chat -> portfolio -> platform
evaluation -> chat, portfolio, platform
```

`server.js` wires the production dependencies together. Live CLI tools use
`scripts/runtime.js`. Source modules do not load environment files or construct
provider clients as import side effects. Architecture tests and ESLint enforce
these boundaries. See [Backend architecture](docs/ARCHITECTURE.md) for the
extension rules.

## Local setup

### Prerequisites

- Node.js 22.13.0 or newer
- npm
- An OpenAI API key
- A Pinecone API key

### Install and configure

```bash
npm install
cp .env.example .env
```

Set at least these values in `.env`:

```dotenv
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=rafa-portfolio
PINECONE_NAMESPACE=development-v1
```

Synchronize the portfolio before the first chat request, then start the server:

```bash
npm run pinecone:sync
npm start
```

The default address is `http://localhost:3001`.

Verify the process and its Pinecone dependency:

```bash
curl http://localhost:3001/healthz
curl http://localhost:3001/readyz
```

Ask a question:

```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What has Rafa built?","locale":"en"}'
```

## API

### `POST /api/chat`

Request:

```json
{
  "message": "What experience does Rafa have with React?",
  "locale": "en",
  "history": [
    { "role": "user", "content": "Tell me about Rafa." },
    { "role": "assistant", "content": "Rafa is a full-stack engineer." }
  ]
}
```

- `message` is required, trimmed, and limited to 1,000 characters.
- `locale` accepts `en` or `es` and defaults to `en`.
- `history` is optional and accepts at most 10 entries.
- Each history entry requires a `user` or `assistant` role and non-empty content
  of at most 1,000 characters.

Successful response:

```json
{
  "content": "Rafa has worked with React on web and mobile applications...",
  "locale": "en",
  "sources": [
    {
      "id": "experience-energy-ogre-application-development-en",
      "itemId": "experience-energy-ogre",
      "score": 0.61,
      "title": "Full Stack Developer at Energy Ogre",
      "contentType": "experience",
      "sectionId": "application-development",
      "topic": "application-development"
    }
  ]
}
```

If the selected evidence cannot answer the question, the model is instructed
to return a fixed localized fallback instead of inventing details.

### Health endpoints

| Endpoint | Purpose | Dependency calls |
| --- | --- | --- |
| `GET /healthz` | Confirms that the HTTP process is running | None |
| `GET /readyz` | Checks required configuration and Pinecone index connectivity | Pinecone `describeIndex` |

Readiness successes are cached for 30 seconds and failures for 5 seconds. It
returns HTTP `503` when the service cannot handle grounded chat traffic.

### Request behavior

- Every response includes an `x-request-id` header. Error bodies also include
  the matching `requestId`.
- CORS uses the `CORS_ALLOWED_ORIGINS` allowlist. Requests without an `Origin`
  header, such as server-to-server calls, are allowed.
- Only `/api/chat` is rate limited. The limiter is in-memory and per IP, so it
  is local to each server instance.
- Oversized JSON is rejected before chat processing. Invalid JSON and invalid
  chat payloads return safe client errors.
- A chat timeout aborts downstream work and returns HTTP `504`.
- Logs are newline-delimited JSON. Request bodies are not logged, and API keys
  plus sensitive field names are redacted.
- `SIGINT` and `SIGTERM` stop accepting requests, close idle connections, and
  allow active requests to finish until the shutdown timeout expires.

## Configuration

Defaults are defined in `src/platform/config.js` and documented in
`.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Selects `development`, `test`, or `production` defaults |
| `PORT` | `3001` | HTTP port |
| `HOST` | `0.0.0.0` | HTTP bind address |
| `TRUST_PROXY` | `false` | Trusts one reverse-proxy hop when `true` |
| `CORS_ALLOWED_ORIGINS` | Portfolio site and localhost | Comma-separated exact origins |
| `JSON_BODY_LIMIT` | `32kb` | Maximum JSON request-body size |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Chat rate-limit window |
| `RATE_LIMIT_MAX_REQUESTS` | `20` | Requests per IP in one window |
| `CHAT_REQUEST_TIMEOUT_MS` | `25000` | End-to-end chat deadline |
| `READINESS_TIMEOUT_MS` | `3000` | Pinecone readiness deadline |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful shutdown deadline |
| `OPENAI_API_KEY` | required | OpenAI authentication |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat generation model |
| `OPENAI_EVAL_MODEL` | `OPENAI_MODEL` | Optional groundedness grader model |
| `PINECONE_API_KEY` | required | Pinecone authentication |
| `PINECONE_INDEX` | `rafa-portfolio` | Integrated-embedding index name |
| `PINECONE_NAMESPACE` | `<NODE_ENV>-v1` | Environment and dataset isolation |

`TRUST_PROXY=true` should be used only behind the expected reverse proxy,
because Express uses the derived client IP for rate limiting.

## Command reference

### Run and inspect

| Command | What it does | External services |
| --- | --- | --- |
| `npm start` | Starts the HTTP server | OpenAI and Pinecone are called by requests; startup only constructs clients |
| `npm run content:validate` | Validates `portfolio.json` and generates all chunks | None |
| `npm run chunks:inspect` | Prints every generated chunk and estimated size | None |
| `npm run pinecone:sync` | Creates the index if missing, upserts current chunks, and deletes stale IDs in the namespace | Pinecone; changes remote data |
| `npm run pinecone:search -- --locale=en "question"` | Runs a top-three search without answer generation | Pinecone |

Because synchronization deletes unknown record IDs from the configured
namespace, use a dedicated namespace for each environment and dataset version.

### Tests and static checks

| Command | What it does |
| --- | --- |
| `npm test` | Runs the complete deterministic suite with Node's test runner |
| `npm run test:watch` | Reruns tests when files change |
| `npm run lint` | Runs ESLint, including module-boundary rules |
| `npm run syntax:validate` | Runs `node --check` over project JavaScript files |
| `npm run evals:validate` | Validates retrieval fixtures and referenced chunk IDs |
| `npm run evals:answers:validate` | Validates the 20 bilingual answer cases |
| `npm run evals:conversation:validate` | Validates the 10 multi-turn scenarios |

These checks do not require provider credentials or make network calls.

### Live evaluations

| Command | What it measures | External services |
| --- | --- | --- |
| `npm run evals:retrieval` | Overall and project Recall@3 | Pinecone |
| `npm run evals:answers` | Language, fallback, required facts, sources, and project ordering | Pinecone and OpenAI |
| `npm run evals:answers:judge` | Groundedness, correctness, relevance, completeness, and unsupported claims on selected high-risk cases | Pinecone and OpenAI generation plus grading |
| `npm run evals:conversation` | Multi-turn behavior, follow-ups, language changes, prompt injection, and history limits | Pinecone and OpenAI |
| `npm run evals:conversation -- <scenario-id>` | Reruns one or more named conversation scenarios | Pinecone and OpenAI |

Live checks incur provider usage. Their default pass thresholds can be changed
with `EVAL_MIN_RECALL`, `EVAL_MIN_ANSWER_PASS_RATE`,
`EVAL_MIN_CONVERSATION_TURN_PASS_RATE`, `EVAL_MIN_JUDGE_PASS_RATE`, and the
four `EVAL_MIN_*` judge-dimension variables shown in `.env.example`.

### Release checks

```bash
npm run release:check
```

The default release check validates production configuration, syntax, lint,
Git whitespace, portfolio content, all evaluation fixtures, and the test suite.
It does not synchronize Pinecone or run live model evaluations.

If a sibling `../personal-portafolio` repository exists, the command also runs
its production build. Set `RELEASE_FRONTEND_DIR` to use a different frontend;
when neither path exists, the frontend build is skipped.

To validate a completed production file directly:

```bash
cp .env.production.example .env.production
# Replace every placeholder, then run:
npm run config:production:validate
```

You can also pass a file explicitly:

```bash
npm run config:production:validate -- /path/to/production.env
```

For an authorized release check that also runs the retrieval, answer, and
conversation suites against live providers:

```bash
RELEASE_ENV_FILE=.env.production npm run release:check -- --live
```

## Common engineering workflows

### Change portfolio content

1. Edit `content/portfolio.json` in both languages.
2. Run `npm run content:validate` and `npm run chunks:inspect`.
3. Update fixtures if chunk IDs or expected facts changed.
4. Run the fixture validators and `npm test`.
5. Synchronize the intended Pinecone namespace.
6. Run live retrieval and answer evaluations before release.

### Change retrieval or generation behavior

1. Add or update deterministic tests for the policy or prompt contract.
2. Run `npm test` and `npm run lint`.
3. Run the relevant live evaluation suite.
4. Use `npm run release:check -- --live` before deployment when provider usage
   is authorized.

### Add a backend feature

Place behavior in the module that owns it and inject provider dependencies at
`server.js` or `scripts/runtime.js`. Keep HTTP concerns in `src/http`, chat
orchestration in `src/chat`, provider record/search details in `src/portfolio`,
and evaluation-only behavior in `src/evaluation`.

## Additional documentation

- [Backend architecture](docs/ARCHITECTURE.md)
- [Current RAG flow](docs/rag-current-flow.md)
- [Chunking strategy](docs/chunking-strategy.md)
- [Pinecone RAG workflow](docs/pinecone-rag-v2.md)
- [Chat API details](docs/rag-v2-chat-api.md)
