# Backend architecture

The backend is a feature-first modular monolith. Modules are grouped by the
business or operational capability they own instead of generic controller,
service, and utility layers.

```text
server.js / scripts
        |
        +--> http --------> chat --------> portfolio --------> platform
        |
        +--> evaluation ---> chat/portfolio/platform
```

## Modules

- `src/platform` contains configuration parsing, provider client factories,
  logging, timeouts, and server lifecycle utilities. It cannot depend on a
  feature module.
- `src/portfolio` owns canonical content loading, semantic chunks, Pinecone
  record mapping and synchronization, retrieval, and reranking.
- `src/chat` owns the API request contract, query policy, answer orchestration,
  prompt construction, and public source mapping.
- `src/http` adapts the chat feature to Express and owns routes, middleware,
  readiness, request protection, and safe HTTP errors.
- `src/evaluation` contains offline retrieval, answer, conversation, and model
  grading logic. The running server never imports this module.

`server.js` is the production composition root. It loads configuration and
constructs every client and service explicitly. Live CLI commands use
`scripts/runtime.js` as their separate composition helper. Importing a feature
module must not load `.env`, read portfolio content, or create a provider
client as a side effect.

## Dependency rules

Dependencies point inward toward stable capabilities:

```text
http -> chat -> portfolio -> platform
evaluation -> chat, portfolio, platform
```

Modules use direct file imports rather than barrel files. Production modules
must not import `evaluation`, and `http` must not bypass `chat` to use portfolio
internals. ESLint and `test/architecture.test.js` enforce these boundaries,
detect circular source dependencies, and reject source folders containing only
one JavaScript module.

## Request data flow

1. HTTP middleware assigns a request ID, applies CORS and body limits, and
   records safe request metadata.
2. The chat route validates the body and applies the request timeout.
3. The retrieval policy classifies the question and creates a local or
   Pinecone retrieval plan.
4. The chat service selects and orders grounded evidence.
5. The answer generator sends that evidence and recent history to OpenAI.
6. The HTTP response returns the localized answer and compact public sources.

## Extending the backend

Add behavior to the module that owns it and inject external dependencies at a
composition root. Keep provider-specific record shapes inside `portfolio`,
HTTP status handling inside `http`, and evaluation-only behavior inside
`evaluation`. Create a new source folder only when it starts with at least two
cohesive modules and has a clear allowed dependency direction.
