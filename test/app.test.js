import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";

process.env.OPENAI_API_KEY ??= "test-openai-key";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_API_KEY ??= "test-supabase-key";

const { createApp } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");

const silentLogger = {
  info() {},
  error() {},
};

let server;
let baseUrl;

before(async () => {
  const app = createApp({ appLogger: silentLogger });

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

async function withTestServer(app, callback) {
  const testServer = app.listen(0, "127.0.0.1");
  await once(testServer, "listening");
  const address = testServer.address();

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      testServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

after(async () => {
  if (!server?.listening) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

test("GET /healthz reports that the process is healthy", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok" });
  assert.ok(response.headers.get("x-request-id"));
  assert.equal(response.headers.get("x-powered-by"), null);
});

test("POST /api/createEmbedding rejects a missing message", async () => {
  const response = await fetch(`${baseUrl}/api/createEmbedding`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: "Missing or invalid 'message'." });
});

test("POST /api/createEmbedding rejects a non-string message", async () => {
  const response = await fetch(`${baseUrl}/api/createEmbedding`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: 42 }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: "Missing or invalid 'message'." });
});

test("POST /api/chat rejects a missing message before calling external services", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locale: "en" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "message must be a non-empty string.");
  assert.ok(body.requestId);
});

test("POST /api/chat rejects an unsupported locale", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Hello", locale: "fr" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, 'locale must be either "en" or "es".');
  assert.ok(body.requestId);
});

test("CORS rejects an origin outside the configured allowlist", async () => {
  const response = await fetch(`${baseUrl}/healthz`, {
    headers: { origin: "https://attacker.example" },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, "Origin is not allowed.");
  assert.ok(body.requestId);
});

test("JSON request bodies larger than the configured limit are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "x".repeat(40_000) }),
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error, "Request body is too large.");
  assert.ok(body.requestId);
});

test("malformed JSON receives a safe client error", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{broken-json",
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Request body contains invalid JSON.");
  assert.ok(body.requestId);
});

test("chat requests are rate limited without affecting other endpoints", async () => {
  const app = createApp({
    environment: { ...env, RATE_LIMIT_MAX_REQUESTS: 1 },
    appLogger: silentLogger,
    chatAnswer: async (request) => ({
      content: "A test answer.",
      locale: request.locale,
      sources: [],
    }),
  });

  await withTestServer(app, async (url) => {
    const options = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    };
    const first = await fetch(`${url}/api/chat`, options);
    const second = await fetch(`${url}/api/chat`, options);
    const health = await fetch(`${url}/healthz`);

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(second.headers.get("ratelimit-remaining"), "0");
    assert.ok(second.headers.get("retry-after"));
    assert.equal(health.status, 200);
  });
});

test("slow chat requests return a safe timeout response", async () => {
  const app = createApp({
    environment: { ...env, CHAT_REQUEST_TIMEOUT_MS: 10 },
    appLogger: silentLogger,
    chatAnswer: async (_request, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });

  await withTestServer(app, async (url) => {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    const body = await response.json();

    assert.equal(response.status, 504);
    assert.equal(
      body.error,
      "RafaBot took too long to respond. Please try again.",
    );
    assert.ok(body.requestId);
  });
});

test("readiness endpoint reports dependency state without internal errors", async () => {
  const readyApp = createApp({
    appLogger: silentLogger,
    readinessCheck: async () => ({
      ready: true,
      services: { configuration: "ready", pinecone: "ready" },
    }),
  });
  const unavailableApp = createApp({
    appLogger: silentLogger,
    readinessCheck: async () => ({
      ready: false,
      services: { configuration: "ready", pinecone: "unavailable" },
    }),
  });

  await withTestServer(readyApp, async (url) => {
    const response = await fetch(`${url}/readyz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ready",
      services: { configuration: "ready", pinecone: "ready" },
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  await withTestServer(unavailableApp, async (url) => {
    const response = await fetch(`${url}/readyz`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.deepEqual(body, {
      status: "not_ready",
      services: { configuration: "ready", pinecone: "unavailable" },
    });
    assert.equal(JSON.stringify(body).includes("error"), false);
  });
});

test("request logger records metadata without request content", async () => {
  const records = [];
  const app = createApp({
    appLogger: {
      info(event, fields) {
        records.push({ event, ...fields });
      },
      error() {},
    },
  });

  await withTestServer(app, async (url) => {
    const response = await fetch(`${url}/healthz`);
    assert.equal(response.status, 200);
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].event, "http_request");
  assert.equal(records[0].method, "GET");
  assert.equal(records[0].path, "/healthz");
  assert.equal(records[0].statusCode, 200);
  assert.equal(typeof records[0].durationMs, "number");
  assert.equal("body" in records[0], false);
});
