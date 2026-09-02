import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReleasePlan } from "../scripts/releaseCheck.js";

test("default release plan contains only local checks", () => {
  const plan = buildReleasePlan();
  const labels = plan.map(({ label }) => label);

  assert.deepEqual(labels, [
    "Production configuration",
    "JavaScript syntax",
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
