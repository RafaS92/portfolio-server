import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";

process.env.OPENAI_API_KEY ??= "test-openai-key";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_API_KEY ??= "test-supabase-key";

const { createApp } = await import("../src/app.js");

let server;
let baseUrl;

before(async () => {
  const app = createApp();

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

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
