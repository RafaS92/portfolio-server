import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  buildReleasePlan,
  resolveFrontendDirectory,
} from "../scripts/releaseCheck.js";

test("default release plan contains only local checks", () => {
  const plan = buildReleasePlan();
  const labels = plan.map(({ label }) => label);

  assert.deepEqual(labels, [
    "Production configuration",
    "JavaScript syntax",
    "JavaScript lint",
    "Git whitespace",
    "Portfolio content",
    "Retrieval evaluation fixtures",
    "Answer evaluation fixtures",
    "Conversation evaluation fixtures",
    "Automated tests",
  ]);
  assert.equal(plan.some(({ external }) => external), false);
  assert.equal(labels.includes("Frontend production build"), false);
});

test("live release plan explicitly adds external RAG evaluations", () => {
  const plan = buildReleasePlan({ live: true });
  const externalChecks = plan.filter(({ external }) => external);

  assert.deepEqual(
    externalChecks.map(({ label }) => label),
    [
      "Live Pinecone retrieval evaluation",
      "Live OpenAI answer evaluation",
      "Live multi-turn evaluation",
    ],
  );
});

test("frontend build is included only when its directory is configured", () => {
  const plan = buildReleasePlan({ frontendDirectory: "../portfolio-client" });
  const frontendCheck = plan.at(-1);

  assert.equal(frontendCheck.label, "Frontend production build");
  assert.deepEqual(frontendCheck.args, ["run", "build"]);
  assert.equal(frontendCheck.cwd.endsWith("portfolio-client"), true);
});

test("configured frontend directory overrides sibling discovery", () => {
  const root = path.join(os.tmpdir(), "portfolio-server");

  assert.equal(
    resolveFrontendDirectory({
      configuredDirectory: "../custom-frontend",
      root,
    }),
    path.resolve(root, "../custom-frontend"),
  );
});

test("frontend directory is discovered beside the backend repository", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "release-check-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  const root = path.join(workspace, "portfolio-server");
  const frontendDirectory = path.join(workspace, "personal-portafolio");
  fs.mkdirSync(root);
  fs.mkdirSync(frontendDirectory);
  fs.writeFileSync(path.join(frontendDirectory, "package.json"), "{}");

  assert.equal(resolveFrontendDirectory({ root }), frontendDirectory);
});

test("frontend discovery stays optional when the sibling is absent", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "release-check-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  assert.equal(
    resolveFrontendDirectory({
      root: path.join(workspace, "portfolio-server"),
      configuredDirectory: "",
    }),
    undefined,
  );
});
