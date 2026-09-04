## The architecture in one sentence

A feature-first Node.js service synchronizes curated bilingual knowledge into a Pinecone integrated-embedding index, retrieves and reranks evidence for each request, and sends only selected context to the OpenAI Responses API.

The architecture has two separate paths:

1. **Offline knowledge path:** canonical JSON → validation → semantic chunks → Pinecone records → integrated embeddings → namespace synchronization.
2. **Online request path:** HTTP protections → request validation → retrieval plan → semantic or local selection → reranking → grounded generation → public sources.

### What these two paths mean

The arrows above describe two jobs that happen at different times.

The **offline knowledge path** runs when I add or change portfolio content. It prepares the information before a visitor asks anything:

1. **Canonical JSON:** `content/portfolio.json` is the source of truth. It contains the approved facts that RafaBot is allowed to use.
2. **Validation:** the application checks that every item has valid IDs, supported content types, English and Spanish text, and the required metadata. Invalid content is rejected before it reaches Pinecone.
3. **Semantic chunks:** each portfolio section becomes a small, self-contained unit of meaning. For example, one chunk may describe a project's architecture while another describes its result.
4. **Pinecone records:** each chunk is converted into a record containing the searchable text and metadata such as language, title, topic, technologies, and tags.
5. **Integrated embeddings:** Pinecone converts the `chunk_text` into a numeric vector. Text with a similar meaning is placed near each other in vector space, even when it does not use exactly the same words.
6. **Namespace synchronization:** the current records are written to the environment's namespace and old records that no longer exist in the JSON are deleted.

This path is called **offline** because it does not run while a visitor is waiting for an answer. It is a preparation and synchronization job.

The **online request path** runs every time a visitor sends a chat message:

1. **HTTP protections:** the API assigns a request ID and applies CORS, body-size limits, and per-IP rate limiting.
2. **Request validation:** the server verifies the message, locale, and conversation history before spending money on external AI services.
3. **Retrieval plan:** the service decides how to find evidence. Most questions use Pinecone semantic search; a few known guided topics use exact local portfolio sections.
4. **Candidate retrieval:** Pinecone compares the meaning of the question with the stored vectors and returns potentially relevant chunks in the requested language.
5. **Reranking and selection:** the application scores the candidates again using vector similarity, matching words, metadata, and portfolio-specific concepts. It normally reduces 30 candidates to the best three pieces of evidence.
6. **Grounded generation:** only those selected chunks, the validated question, and bounded recent history are sent to the OpenAI model. The model is instructed to answer only from that evidence.
7. **Answer and public sources:** the visitor receives a concise answer plus safe source metadata showing which portfolio sections supported it.

For example, if a visitor asks, **“What experience does Rafa have with React?”**, the request does not search the original JSON line by line. Pinecone first finds chunks whose meaning is related to React experience. RafaBot reranks those results, selects the strongest evidence, and gives only that evidence to the model. The model then writes the final response instead of inventing an answer from its general knowledge.

The reason for separating the paths is reliability and speed. Content validation and embedding happen before traffic arrives, while the online path does only the work required to answer the current request. It also means a content update can be reviewed and synchronized without changing the chat API.

`server.js` is the production composition root. Provider clients are constructed and injected there rather than created as import side effects.

## Video outline

| Time | Section | Purpose |
| --- | --- | --- |
| 0:00–0:35 | Hook | Establish the production-ready claim. |
| 0:35–1:20 | Architecture | Separate offline synchronization from online requests. |
| 1:20–2:30 | Knowledge pipeline | Validate, chunk, map, and synchronize content. |
| 2:30–3:30 | Chunking | Explain semantic units, context, IDs, and bilingual isolation. |
| 3:30–4:30 | Embeddings and Pinecone | Explain integrated inference and record metadata. |
| 4:30–6:15 | Retrieval | Explain candidate generation, reranking, and retrieval policies. |
| 6:15–7:20 | Grounded generation | Bound the model with selected evidence and exact fallbacks. |
| 7:20–9:10 | Security and abuse prevention | Show layered application protections and their limits. |
| 9:10–10:25 | Operations | Show readiness, logging, timeouts, and graceful shutdown. |
| 10:25–11:40 | Evaluation and optimization | Demonstrate repeatable quality checks. |
| 11:40–12:20 | Honest boundary and close | State what is ready and what larger-scale deployment needs. |

### How to read the screen directions

Each segment tells you exactly what should be visible while you speak:

- **Primary screen** is the main visual: the live chatbot, the architecture diagram, a source file, or the terminal.
- **Action** describes the movement: zoom, highlight, scroll, type, or switch tabs.
- **Overlay** is a short phrase or number added during editing. Keep overlays brief so viewers listen to you instead of reading a second script.
- Stay on one visual long enough for viewers to understand it. Switch screens when the idea changes, not after every sentence.

---

## 1. Open with the claim

**Time:** 0:00–0:35

### Voiceover

> I built RafaBot as an AI system ready for production at the application layer. The interesting part is not the chat box. It is the system behind it: controlled knowledge, semantic retrieval, grounding, evaluation, request protection, and predictable behavior when a dependency fails. This walkthrough shows how those pieces fit together and why I made each tradeoff.

### Screen direction

- **0:00–0:12 — Primary screen:** the live portfolio chatbot. Ask, “What experience does Rafa have building production systems?” Keep the typed question and returned sources visible.
- **0:12–0:22 — Action:** zoom slightly into the response, then highlight the source cards. This proves that the answer comes from retrieved portfolio evidence.
- **0:22–0:35 — Primary screen:** switch to `assets/rafabot-rag-architecture.png` and show the complete diagram without zooming yet.
- **Overlay:** **Production-ready AI is a system, not a prompt.**

## 2. Explain the two system flows

**Time:** 0:35–1:20

### Voiceover

> The architecture has an offline synchronization path and an online request path. Offline, I validate the portfolio, create semantic English and Spanish chunks, map them to Pinecone records, and synchronize a namespaced index. Online, the API validates a visitor request, builds a retrieval plan, searches or directly selects evidence, reranks it, and sends only the final context to the model. The chat service is stateless: it does not retain a conversation session between requests, so the browser resends a validated history of up to 10 messages. That means any application instance can handle the next request. Pinecone still stores the portfolio knowledge, but OpenAI response storage is disabled and chat bodies are not written to application logs. Separating these responsibilities keeps indexing out of request latency and makes the runtime easier to scale and reason about.

### Screen direction

- **0:35–0:52 — Primary screen:** keep `assets/rafabot-rag-architecture.png` full screen. Dim the right half and trace the six **Content Synchronization** steps on the left.
- **0:52–1:08 — Action:** dim the left half and trace the eight **Chat Request** steps on the right.
- **1:08–1:15 — Primary screen:** open `docs/ARCHITECTURE.md` and highlight the dependency diagram: `http → chat → portfolio → platform`.
- **1:15–1:20 — Primary screen:** switch to `server.js` and briefly highlight where configuration and provider clients are assembled.
- **Overlay:** **Offline = prepare knowledge. Online = answer one request.**

## 3. Walk through ingestion and synchronization

**Time:** 1:20–2:30

### Voiceover

> The knowledge source is a versioned portfolio JSON file, not unstructured scraped prose. Before indexing anything, the system validates content types, IDs, bilingual fields, semantic sections, tags, technologies, and project ordering. Each section produces one English record and one Spanish record, for 174 chunks in the current dataset. IDs follow a deterministic item, section, and locale pattern, so synchronization is idempotent: the job can delete stale IDs and upsert the current set without creating duplicates. Records are uploaded in batches of 96 to a deletion-protected Pinecone index in AWS `us-east-1`, with locale configured as a filterable field.

### Screen direction

- **1:20–1:38 — Primary screen:** open `content/portfolio.json`. Expand one project and point to its bilingual title, technologies, tags, and semantic sections. Do not scroll through the whole file.
- **1:38–1:52 — Primary screen:** switch to `src/portfolio/content.js`. Highlight the validation loop and one failed-condition message.
- **1:52–2:08 — Primary screen:** switch to `src/portfolio/chunks.js`. Highlight the deterministic ID: `` `${item.id}-${section.id}-${locale}` ``.
- **2:08–2:22 — Primary screen:** switch to `src/portfolio/pinecone-index.js`. Highlight stale-ID deletion and the 96-record batch loop.
- **2:22–2:30 — Primary screen:** show a prepared terminal and run `npm run content:validate`. Follow it with the final `Total chunks: 174` line from `npm run chunks:inspect`.
- **Overlay:** **174 chunks · 87 English · 87 Spanish · deterministic IDs**

### Transition

> Retrieval quality begins before embeddings. It begins with the unit of meaning that we choose to embed.

## 4. Explain the chunking strategy

**Time:** 2:30–3:30

### Voiceover

> I use semantic chunking based on authored portfolio sections instead of splitting text every fixed number of characters. A section such as application development, testing reliability, or project overview stays intact as one retrievable idea. I prepend identifying context such as title, role, organization, location, and dates so an isolated result remains understandable. There is no overlap because the source is small, curated, and already divided into meaningful sections. That is a deliberate domain-specific choice, not a universal chunking rule for long PDFs. The current chunks average about 107 estimated tokens, and English and Spanish are stored as separate records so retrieval never has to mix languages.

### Screen direction

- **2:30–2:46 — Primary screen:** show only `buildContext` in `src/portfolio/chunks.js`. Highlight title, role, organization, location, and dates as they are added.
- **2:46–3:02 — Primary screen:** move down to `createPortfolioChunks`. Trace one item → one section → two locales.
- **3:02–3:20 — Primary screen:** use terminal output from `npm run chunks:inspect`. Freeze on one English chunk, then its Spanish partner. Box the context sentence separately from the section body.
- **3:20–3:30 — Overlay:** **Semantic section · no overlap · avg. 107 tokens · locale isolated**
- Do not show a generic chunking diagram here; the real chunk output is stronger proof that you designed and inspected the data.

## 5. Explain embeddings and Pinecone

**Time:** 3:30–4:30

### Voiceover

> RafaBot uses Pinecone integrated inference. The application sends a record with a `chunk_text` field, and the index embeds that field using `llama-text-embed-v2`. At query time, the application sends text again, so Pinecone applies the matching embedding path for semantic search. The service does not manually calculate or serialize vector arrays, which prevents index-time and query-time models from drifting apart. Each record also carries metadata such as locale, topic, dates, technologies, and tags. Integrated inference simplifies operations, but it couples the index to that embedding configuration, so a future model migration should use a versioned index or namespace and repeat the retrieval evaluations.

### Screen direction

- **3:30–3:48 — Primary screen:** open `src/portfolio/pinecone-index.js`. Highlight `createIndexForModel`, `llama-text-embed-v2`, and the field map from `text` to `chunk_text`.
- **3:48–4:05 — Primary screen:** open `src/portfolio/pinecone-records.js`. Use two colored editor highlights: one around `chunk_text`, another around the metadata fields.
- **4:05–4:20 — Primary screen:** return to the left side of `assets/rafabot-rag-architecture.png` and zoom into steps 4–6: records, embeddings, and namespace synchronization.
- **4:20–4:30 — Overlay:** **Text in → vector created by Pinecone → metadata retained for filtering and sources**

### Transition

> Vector similarity produces candidates. It does not make the final evidence decision.

## 6. Show retrieval as a controlled policy

**Time:** 4:30–6:15

### Voiceover

> For a normal semantic question, the service retrieves 30 locale-filtered candidates even though the model usually receives only three. It reranks those candidates using the vector score, lexical coverage in the body and metadata, portfolio-specific concept matches, and a small focus bonus for concise chunks. This separates semantic recall from evidence precision. Broad project discovery deliberately searches up to 100 candidates, deduplicates by project, and returns four projects in the curated portfolio order. Guided topics can select exact local sections, and contextual follow-ups include the preceding user question in the retrieval query. These are explicit retrieval policies, not hidden prompt tricks, and I change them only when evaluation shows an improvement.

### Screen direction

- **4:30–4:50 — Primary screen:** open `src/portfolio/pinecone-search.js`. Highlight the locale filter and the logic that expands a normal request to 30 candidates.
- **4:50–5:12 — Primary screen:** open `src/portfolio/reranker.js`. Highlight the final score formula one term at a time as you name vector score, metadata coverage, body coverage, concept coverage, and focus.
- **5:12–5:28 — Overlay animation:** show **30 candidates → rerank → 3 evidence chunks**. This should be a simple text funnel, not another architecture diagram.
- **5:28–5:52 — Primary screen:** open `src/chat/retrieval-policy.js`. Highlight the three branches: normal search, broad project discovery, and targeted local selection.
- **5:52–6:15 — Primary screen:** return to the live chatbot. Ask one follow-up such as “What did he build with it?” and briefly show the earlier user message being sent in the browser network payload.

## 7. Explain grounded answer generation

**Time:** 6:15–7:20

### Voiceover

> The selected chunks are clearly separated and labeled inside the model context. Instructions require the answer to use only those facts, remain inside Rafa’s portfolio, answer in English or Spanish, and return an exact localized fallback when the evidence is insufficient. The visitor message is explicitly treated as untrusted content. Generation uses low temperature, a 250-token output limit, and disabled response storage. Grounding is therefore not one prompt sentence; it is the combination of evidence selection, strict scope, bounded generation, fallbacks, returned sources, and evaluation.

### Screen direction

- **6:15–6:35 — Primary screen:** open `src/chat/answer-generator.js`. Highlight `formatRetrievedContext` and show how each chunk receives a visible source label.
- **6:35–6:52 — Action:** move to the instruction block and highlight only four phrases: “use only,” “untrusted content,” “never invent,” and the exact fallback behavior.
- **6:52–7:05 — Primary screen:** show the Responses API call. Highlight `temperature: 0.2`, `max_output_tokens: 250`, and `store: false`.
- **7:05–7:20 — Primary screen:** use the live chatbot for an unsupported portfolio question. Keep the exact fallback and returned source area visible.
- **Overlay:** **Selected evidence + strict scope + bounded output + evaluation**

---

## 8. Security and abuse prevention

**Time:** 7:20–9:10

### Voiceover

> An internet-facing chatbot is an abuse target because every request can consume external compute. RafaBot uses defense in depth around that cost and around the model. The service limits who can call it from browsers, how often an IP can call the chat route, how large and how long a request can be, how much conversation history reaches the model, and how long downstream processing may run. It treats visitor text as untrusted data, restricts generation to retrieved portfolio evidence, avoids logging request bodies, redacts secrets, and returns safe errors rather than provider internals.

> These controls reduce abuse; they do not make abuse impossible. The current rate limiter is process-local, CORS is a browser policy rather than authentication, and requests without an `Origin` header are intentionally allowed for server-to-server use. A larger public deployment should enforce shared quotas and traffic controls at the gateway or edge.

### Security reference for your preparation

Do not put this entire table on screen. Use it to understand the controls, then show the specific code and response described in the screen direction below.

| Threat or failure | Implemented control | Important boundary |
| --- | --- | --- |
| Automated request flooding | Per-IP rate limiting on `/api/chat`; default 20 requests per 60 seconds; `429` and `Retry-After` responses | The limiter is in memory and applies independently to each server instance. |
| Oversized or expensive input | 32 KB JSON body limit; message and each history entry capped at 1,000 characters; history capped at 10 entries | Limits bound individual requests but do not provide per-account or daily budgets. |
| Slow downstream calls or resource exhaustion | End-to-end chat timeout, default 25 seconds, using `AbortController` to signal cancellation | Provider-side work may not stop instantly if a dependency ignores cancellation. |
| Prompt injection in visitor text | Instructions explicitly classify the visitor question as untrusted and require answers from supplied portfolio context only | Prompt defenses reduce risk but cannot provide a mathematical guarantee. Evaluation and monitoring remain necessary. |
| Model asked for unrelated content | Scope restriction to Rafa and the portfolio; exact localized out-of-scope response | This is application policy, not a general content-moderation system. |
| Hallucinated portfolio facts | Selected evidence only, exact insufficient-evidence fallback, low temperature, output cap, source metadata, groundedness evaluation | No generative model is guaranteed to be hallucination-free. |
| Cross-language evidence leakage | Separate English and Spanish chunks plus a required Pinecone locale filter | Correct metadata and synchronization remain part of the trust boundary. |
| Browser calls from unauthorized sites | Exact-origin CORS allowlist; rejected origins receive `403` | CORS is not authentication and does not block scripts, servers, or clients that omit or forge browser-independent headers. |
| Accidental framework disclosure | Express `x-powered-by` header is disabled | This is minor fingerprint reduction, not a primary security control. |
| Secret or personal-data exposure in logs | Request bodies are not logged; API keys, authorization, cookies, passwords, secrets, and token-like fields are redacted; configured secret values are replaced | Operators must still control log access, retention, export destinations, and backups. |
| Internal error disclosure | Safe `400`, `403`, `413`, `429`, `500`, and `504` response bodies include a request ID but hide stack traces and provider errors | Detailed errors still exist in protected server logs for debugging. |
| Misconfigured production environment | Startup/release validation requires provider keys and rejects development namespaces and localhost CORS origins | Secret storage and rotation belong to the deployment platform. |
| Incorrect client-IP attribution | `TRUST_PROXY` is explicit and disabled by default | It must be enabled only behind the expected proxy; incorrect configuration can weaken IP-based limiting. |
| Unwanted provider retention | OpenAI generation requests set `store: false` | Review the retention behavior of every provider and logging system used in the deployed environment. |
| Dependency outage | Readiness checks Pinecone connectivity with a three-second timeout and returns `503` when the service cannot support grounded traffic | Readiness is not a circuit breaker and does not provide automatic failover. |

### Screen direction

- **7:20–7:38 — Primary screen:** show the chatbot normally, then cut to a terminal or automated test that produces a `429` response. Keep the `Retry-After` and `RateLimit-*` headers visible. Do not repeatedly attack the deployed site just for the recording.
- **7:38–7:58 — Primary screen:** open `src/http/app.js`. Highlight `app.disable("x-powered-by")`, the exact-origin CORS allowlist, the 32 KB JSON limit, and the limiter attached specifically to `/api/chat`.
- **7:58–8:15 — Primary screen:** open `src/chat/request.js`. Highlight the 1,000-character message limit, the maximum of 10 history messages, and locale and role validation.
- **8:15–8:32 — Primary screen:** open `src/http/request-middleware.js`. Follow the flow from the client IP to the in-memory counter and then to the `429` response. Add a small label: **Per-instance protection—not a distributed DDoS defense.**
- **8:32–8:47 — Split screen:** show `src/platform/timeout.js` beside `src/platform/logger.js`. Highlight `AbortController`, the deadline, and redacted field names. Use arrows labeled **Bound work** and **Protect logs**.
- **8:47–9:02 — Primary screen:** return to `src/chat/answer-generator.js`. Highlight the untrusted-input instruction, portfolio-only grounding, output limit, and `store: false`.
- **9:02–9:10 — Primary screen:** show a simple layered-defense graphic with five rings: **Origin → Rate → Input → Retrieval → Generation**. This is the one place where a small custom diagram is more useful than another code file.
- **Overlay:** **Reduce risk, bound cost, fail safely**

### Safe claims to make

- “The service has layered abuse controls that bound request frequency, size, history, output, and execution time.”
- “Visitor input is treated as untrusted data and does not become the system instruction.”
- “Safe errors give the client a request ID without exposing provider failures or stack traces.”
- “The logs preserve operational metadata without storing chat bodies.”
- “The application reduces prompt-injection and hallucination risk through evidence boundaries and evaluation.”

### Claims to avoid

- Do not say: “The chatbot cannot be abused.”
- Do not say: “CORS secures the API.”
- Do not say: “Rate limiting prevents DDoS.”
- Do not say: “RAG eliminates hallucinations.”
- Do not describe the current service as authenticated; the chat endpoint does not implement user authentication.
- Do not describe the service as having a distributed quota; the current limiter is instance-local.

### Recommended next hardening for larger-scale deployment

These are recommendations, not features currently implemented in this repository:

1. Put the service behind a CDN, WAF, or API gateway with shared rate limits and bot protection.
2. Add authenticated user or anonymous-session quotas when product requirements allow it.
3. Add per-minute, per-day, and token/cost budgets rather than request count alone.
4. Use a shared limiter such as Redis if multiple application instances accept traffic directly.
5. Add provider concurrency limits, bulkheads, retries with bounded backoff where safe, and circuit breakers.
6. Add security monitoring and alerts for rejection rates, timeouts, anomalous IPs, unexpected token usage, and spend.
7. Add a moderation layer if the product’s scope or audience requires content-safety classification.
8. Add automated dependency and secret scanning to CI, plus a documented key-rotation and incident-response process.
9. Load-test realistic and adversarial traffic before publishing capacity or availability targets.

### Transition

> Security controls bound the request. Operational controls tell us whether the service can answer it safely right now.

## 9. Prove the production operations

**Time:** 9:10–10:25

### Voiceover

> Every response receives a generated request ID. Logs are newline-delimited JSON and capture method, path, status, and duration without storing request content. Liveness and readiness are separate: `/healthz` confirms that the process is running, while `/readyz` checks whether the service can actually support grounded traffic, including required configuration and Pinecone connectivity. A failed readiness check returns `503`, so an orchestrator can stop routing traffic to an unhealthy instance.

> Successful readiness results are cached for 30 seconds, failures for five seconds, and concurrent checks are coalesced. That avoids turning a health endpoint into unnecessary Pinecone traffic. During shutdown, the server stops accepting new work, closes idle connections, and gives active requests a bounded period to finish. Because requests are stateless, any healthy instance can serve the next request; the tradeoff is that rate limits must move to shared storage when the service scales across instances.

### Screen direction

- **9:10–9:28 — Primary screen:** use a terminal with two clearly labeled requests: `GET /healthz` and `GET /readyz`. Pause on the different response meanings: **process alive** versus **dependencies ready**.
- **9:28–9:43 — Primary screen:** open the readiness implementation in `src/http/`. Highlight the three-second dependency timeout, `503` failure response, 30-second success cache, five-second failure cache, and concurrent-check coalescing. Use `rg "readyz|readiness" src test` before recording to locate the exact current filename.
- **9:43–9:57 — Split screen:** keep an API response with `x-request-id` on the left and the matching structured JSON log event on the right. Highlight the same ID in both places.
- **9:57–10:10 — Primary screen:** show the timeout and readiness tests running, then briefly open the assertions that verify safe status codes.
- **10:10–10:25 — Primary screen:** open `src/platform/server-lifecycle.js` and trace stop-accepting → close-idle → bounded drain. End with a small overlay: **Stateless = no server-owned conversation session between requests.**

## 10. Explain evaluation and optimization

**Time:** 10:25–11:40

### Voiceover

> Production readiness is not a feeling, so the repository has repeatable release checks. The workflow validates production configuration, syntax, lint, Git whitespace, portfolio content, evaluation fixtures, architecture rules, and automated tests. The current repository passes 92 tests. It also contains 94 retrieval cases, 20 bilingual answer cases, and 10 conversation scenarios covering 25 turns. Those fixture counts demonstrate coverage, not accuracy by themselves.

> Optimization happens as a measured pipeline: retrieve broadly for recall, rerank deterministically for precision, send only three strong chunks for a normal query, and bound generation with a low temperature and short output. Optional live evaluations exercise Pinecone, answer generation, multi-turn behavior, and structured grading for groundedness, correctness, relevance, completeness, and unsupported claims. I would change candidate counts or reranking weights only when evaluation against the same namespace and model shows an improvement.

### Screen direction

- **10:25–10:42 — Primary screen:** run `npm test` in a clean terminal and pause on the final passing summary. Record this after verifying the current count; if it changes, say the number shown by the command instead of memorizing 92.
- **10:42–10:54 — Primary screen:** open `scripts/releaseCheck.js` while `npm run release:check` runs in a small terminal panel. Point to the checks as they complete.
- **10:54–11:10 — Three quick cuts:** show one representative entry from `evals/retrieval.json`, one from `evals/answers.json`, and one multi-turn case from `evals/conversations.json`. Do not scroll through entire files.
- **11:10–11:25 — Primary screen:** open `src/evaluation/groundedness.js`. Highlight the evaluated dimensions and the unsupported-claim check.
- **11:25–11:40 — Diagram:** return to the retrieval pipeline and animate **30 candidates → reranking → 3 chunks → bounded answer**. Add a feedback arrow from **Evaluation** back to **Retrieval policy**. This final diagram communicates that optimization is evidence-driven.

## 11. Close with confidence and an honest boundary

**Time:** 11:40–12:20

### Voiceover

> When I say I built an AI system ready for production, I mean the application has controlled ingestion, deterministic indexing, evaluated retrieval, grounded generation, abuse controls, safe errors, observability, readiness checks, and graceful lifecycle behavior. It is designed to fail safely instead of inventing an answer. For a larger multi-instance deployment, I would add edge protection, shared quotas, external metrics and tracing, deployment automation, managed secrets, backups, and load-tested capacity targets. Production readiness is a continuum, and this system has the engineering seams required to move along it.

### Screen direction

- **11:40–11:58 — Primary screen:** show `assets/rafabot-rag-architecture.png` at full resolution. Slowly trace the complete path once, from curated knowledge to answer.
- **11:58–12:10 — Primary screen:** return to the live chatbot with a grounded answer and its sources visible. Overlay four short labels one at a time: **Controlled knowledge. Evaluated retrieval. Bounded generation. Observable service.**
- **12:10–12:20 — End card:** use a clean background with the project name, repository or portfolio URL, and the final line below. Do not end on a wall of code.

### Final line

> The model is one dependency. The product is the system around it.

---

## Recording checklist

- [ ] Demonstrate one precise portfolio question.
- [ ] Demonstrate one broad project-discovery question.
- [ ] Demonstrate one question in Spanish.
- [ ] Demonstrate one contextual follow-up.
- [ ] Demonstrate one unsupported question and its exact fallback.
- [ ] Show the architecture image at full resolution.
- [ ] Show one English and Spanish chunk pair.
- [ ] Show Pinecone metadata and the locale filter without revealing credentials.
- [ ] Demonstrate an oversized, invalid, rate-limited, or timed-out request.
- [ ] Follow a request ID from response to log.
- [ ] Show `npm test` completing successfully.
- [ ] State that the current rate limiter is process-local.
- [ ] Never display `.env`, API keys, authorization headers, cookies, or production secrets.

## Verified implementation facts

| Area | Current implementation |
| --- | --- |
| Runtime | Node.js 22+, Express 5, OpenAI Responses API, Pinecone SDK |
| Knowledge | 174 semantic chunks: 87 English and 87 Spanish |
| Chunk size | 25–286 estimated tokens; 107.4 average; 200-token p95 |
| Chunk ID | `<item-id>-<section-id>-<locale>` |
| Embedding | Pinecone integrated inference using `llama-text-embed-v2` over `chunk_text` |
| Index | AWS `us-east-1`; deletion protection; filterable locale; environment namespace |
| Synchronization | Delete stale IDs and upsert current records in batches of 96 |
| Normal retrieval | 30 candidates → local reranking → three final hits |
| Project discovery | Up to 100 candidates → up to four projects ordered by `archiveOrder` |
| Generation | Temperature 0.2; 250 output tokens; two-to-five-sentence instruction; `store: false` |
| Request bounds | 1,000-character message and history entries; maximum 10 history messages |
| HTTP defaults | 32 KB JSON; 20 chat requests per IP per 60 seconds; 25-second chat timeout |
| Readiness | Three-second dependency timeout; 30-second success cache; five-second failure cache |
| Verification | 92 automated tests; 94 retrieval fixtures; 20 answer cases; 10 conversations and 25 turns |

## Implementation references

| Topic | Repository evidence |
| --- | --- |
| Architecture | `README.md`, `docs/ARCHITECTURE.md`, `assets/rafabot-rag-architecture.png` |
| Content and chunks | `content/portfolio.json`, `src/portfolio/content.js`, `src/portfolio/chunks.js` |
| Pinecone | `src/portfolio/pinecone-index.js`, `pinecone-records.js`, `pinecone-search.js`, `reranker.js` |
| RAG orchestration | `src/chat/retrieval-policy.js`, `service.js`, `answer-generator.js`, `request.js` |
| HTTP security | `src/http/app.js`, `request-middleware.js`, `chat-route.js` |
| Platform safeguards | `src/platform/config.js`, `timeout.js`, `logger.js`, `server-lifecycle.js` |
| Evaluation | `src/evaluation/*`, `evals/*`, `scripts/releaseCheck.js`, `test/*` |
