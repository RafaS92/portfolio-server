import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseEnvironment,
  validateProductionEnvironment,
} from "../src/config/env.js";

test("development configuration has safe local defaults", () => {
  const result = parseEnvironment({});

  assert.equal(result.NODE_ENV, "development");
  assert.equal(result.PORT, 3001);
  assert.equal(result.PINECONE_NAMESPACE, "development-v1");
  assert.deepEqual(result.CORS_ALLOWED_ORIGINS, [
    "https://www.rafaelsvaldez.com",
    "http://localhost:3000",
  ]);
});

test("production defaults to a separate Pinecone namespace", () => {
  const result = parseEnvironment({ NODE_ENV: "production" });
  assert.equal(result.PINECONE_NAMESPACE, "production-v1");
});

test("configuration rejects malformed numbers and origins", () => {
  assert.throws(() => parseEnvironment({ PORT: "3001abc" }), /integer/);
  assert.throws(
    () => parseEnvironment({ CORS_ALLOWED_ORIGINS: "not-a-url" }),
    /invalid URL/,
  );
});

test("production validation rejects development-only settings", () => {
  const base = {
    NODE_ENV: "production",
    OPENAI_API_KEY: "openai-key",
    PINECONE_API_KEY: "pinecone-key",
    PINECONE_NAMESPACE: "production-v1",
    CORS_ALLOWED_ORIGINS: ["https://www.rafaelsvaldez.com"],
  };

  assert.equal(validateProductionEnvironment(base), base);
  assert.throws(
    () =>
      validateProductionEnvironment({
        ...base,
        PINECONE_NAMESPACE: "development-v1",
      }),
    /development Pinecone namespace/,
  );
  assert.throws(
    () =>
      validateProductionEnvironment({
        ...base,
        CORS_ALLOWED_ORIGINS: ["http://localhost:3000"],
      }),
    /localhost/,
  );
});
