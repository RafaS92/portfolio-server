import assert from "node:assert/strict";
import { test } from "node:test";
import { createReadinessCheck } from "../src/services/readiness.js";

const environment = {
  OPENAI_API_KEY: "openai-key",
  PINECONE_API_KEY: "pinecone-key",
  PINECONE_INDEX: "rafa-portfolio",
  READINESS_TIMEOUT_MS: 10,
};
const silentLogger = { info() {}, error() {} };

test("readiness confirms configuration and Pinecone connectivity", async () => {
  let calls = 0;
  const check = createReadinessCheck({
    environment,
    appLogger: silentLogger,
    getClient: () => ({
      async describeIndex(indexName) {
        calls += 1;
        assert.equal(indexName, "rafa-portfolio");
      },
    }),
  });

  assert.deepEqual(await check(), {
    ready: true,
    services: { configuration: "ready", pinecone: "ready" },
  });
  assert.deepEqual(await check(), {
    ready: true,
    services: { configuration: "ready", pinecone: "ready" },
  });
  assert.equal(calls, 1);
});

test("readiness reports missing configuration without contacting Pinecone", async () => {
  let contacted = false;
  const check = createReadinessCheck({
    environment: { ...environment, PINECONE_API_KEY: undefined },
    appLogger: silentLogger,
    getClient() {
      contacted = true;
    },
  });

  assert.deepEqual(await check(), {
    ready: false,
    services: { configuration: "unavailable", pinecone: "not_checked" },
  });
  assert.equal(contacted, false);
});

test("readiness hides Pinecone errors and caches failures briefly", async () => {
  let calls = 0;
  const logged = [];
  const check = createReadinessCheck({
    environment,
    appLogger: {
      info() {},
      error(event) {
        logged.push(event);
      },
    },
    getClient: () => ({
      async describeIndex() {
        calls += 1;
        throw new Error("provider detail must stay internal");
      },
    }),
  });

  const first = await check();
  const second = await check();

  assert.deepEqual(first, {
    ready: false,
    services: { configuration: "ready", pinecone: "unavailable" },
  });
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
  assert.deepEqual(logged, ["readiness_pinecone_failed"]);
  assert.equal(JSON.stringify(first).includes("provider detail"), false);
});

test("readiness times out a hanging Pinecone check", async () => {
  const check = createReadinessCheck({
    environment: { ...environment, READINESS_TIMEOUT_MS: 5 },
    appLogger: silentLogger,
    getClient: () => ({
      describeIndex: () => new Promise(() => {}),
    }),
  });

  assert.deepEqual(await check(), {
    ready: false,
    services: { configuration: "ready", pinecone: "unavailable" },
  });
});
