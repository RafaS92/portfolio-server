import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "../src/http/request-middleware.js";
import {
  OperationTimeoutError,
  withTimeout,
} from "../src/platform/timeout.js";
import { createGracefulShutdown } from "../src/platform/server-lifecycle.js";

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = String(value);
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("rate limiter resets after its configured window", () => {
  let time = 1_000;
  const limit = createRateLimiter({
    windowMs: 1_000,
    maxRequests: 1,
    now: () => time,
  });
  const request = { ip: "127.0.0.1", requestId: "request-1", socket: {} };
  const first = createResponse();
  const second = createResponse();
  const afterReset = createResponse();

  limit(request, first, () => {});
  limit(request, second, () => assert.fail("Second request must be blocked."));
  time = 2_001;
  limit(request, afterReset, () => {});

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 429);
  assert.equal(afterReset.statusCode, 200);
});

test("timeout helper aborts slow operations", async () => {
  let aborted = false;

  await assert.rejects(
    () =>
      withTimeout(
        (signal) =>
          new Promise(() => {
            signal.addEventListener("abort", () => {
              aborted = true;
            });
          }),
        5,
        "Test operation",
      ),
    OperationTimeoutError,
  );
  assert.equal(aborted, true);
});

test("graceful shutdown stops accepting work and completes once", async () => {
  let closeCalls = 0;
  let idleCloseCalls = 0;
  const server = {
    close(callback) {
      closeCalls += 1;
      callback();
    },
    closeIdleConnections() {
      idleCloseCalls += 1;
    },
  };
  const shutdown = createGracefulShutdown(server, { timeoutMs: 100 });

  const first = shutdown();
  const second = shutdown();
  const result = await first;

  assert.equal(first, second);
  assert.deepEqual(result, { forced: false, error: undefined });
  assert.equal(closeCalls, 1);
  assert.equal(idleCloseCalls, 1);
});
