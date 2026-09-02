import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  parseEnvironment,
  validateProductionEnvironment,
} from "../src/platform/config.js";

test("importing configuration does not load dotenv as a side effect", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "config-import-"));
  const environment = { ...process.env };
  delete environment.PORT;
  fs.writeFileSync(path.join(workspace, ".env"), "PORT=4567\n");
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  const configUrl = new URL("../src/platform/config.js", import.meta.url);
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(configUrl.href)}); process.stdout.write(process.env.PORT ?? "unset");`,
    ],
    { cwd: workspace, encoding: "utf8", env: environment },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "unset");
});

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
