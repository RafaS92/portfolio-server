import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger, sanitizeLogValue } from "../src/lib/logger.js";

test("structured logger emits JSON records with stable fields", () => {
  const output = [];
  const logger = createLogger({
    writeInfo: (line) => output.push(line),
    clock: () => new Date("2026-01-02T03:04:05.000Z"),
  });

  logger.info("http_request", { requestId: "abc", statusCode: 200 });

  assert.deepEqual(JSON.parse(output[0]), {
    timestamp: "2026-01-02T03:04:05.000Z",
    level: "info",
    event: "http_request",
    requestId: "abc",
    statusCode: 200,
  });
});

test("logger redacts configured secrets and sensitive field names", () => {
  const output = [];
  const secret = "sk-private-value";
  const logger = createLogger({
    secrets: [secret],
    writeError: (line) => output.push(line),
  });

  logger.error("provider_failed", {
    apiKey: secret,
    authorization: `Bearer ${secret}`,
    error: new Error(`Provider rejected ${secret}`),
  });

  assert.equal(output[0].includes(secret), false);
  assert.equal(output[0].includes("[REDACTED]"), true);
  const record = JSON.parse(output[0]);
  assert.equal(record.apiKey, "[REDACTED]");
  assert.equal(record.authorization, "[REDACTED]");
  assert.equal(record.error.message, "Provider rejected [REDACTED]");
  assert.equal("stack" in record.error, false);
});

test("log sanitizer preserves non-sensitive operational metadata", () => {
  assert.deepEqual(
    sanitizeLogValue({
      requestId: "request-1",
      pineconeIndex: "rafa-portfolio",
      token: "do-not-log",
    }),
    {
      requestId: "request-1",
      pineconeIndex: "rafa-portfolio",
      token: "[REDACTED]",
    },
  );
});
