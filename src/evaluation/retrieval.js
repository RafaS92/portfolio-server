import { readFileSync } from "node:fs";
import { createPortfolioChunks } from "../portfolio/chunks.js";
import { SUPPORTED_LOCALES } from "../portfolio/content.js";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const evalsUrl = new URL("../../evals/retrieval.json", import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid retrieval evaluation: ${message}`);
}

export function validateRetrievalEvals(evaluations) {
  assert(Number.isInteger(evaluations?.version), "version must be an integer");
  assert(Array.isArray(evaluations.cases), "cases must be an array");
  assert(evaluations.cases.length > 0, "cases must not be empty");

  const chunks = createPortfolioChunks();
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const caseIds = new Set();

  for (const evaluation of evaluations.cases) {
    assert(ID_PATTERN.test(evaluation.id), `invalid case id "${evaluation.id}"`);
    assert(!caseIds.has(evaluation.id), `duplicate case id "${evaluation.id}"`);
    caseIds.add(evaluation.id);

    assert(
      SUPPORTED_LOCALES.includes(evaluation.locale),
      `${evaluation.id} has an unsupported locale`,
    );
    assert(
      typeof evaluation.category === "string" && evaluation.category.trim(),
      `${evaluation.id}.category must be a non-empty string`,
    );
    assert(
      typeof evaluation.question === "string" && evaluation.question.trim(),
      `${evaluation.id}.question must be a non-empty string`,
    );
    assert(
      Array.isArray(evaluation.expectedChunkIds),
      `${evaluation.id}.expectedChunkIds must be an array`,
    );

    for (const chunkId of evaluation.expectedChunkIds) {
      const chunk = chunksById.get(chunkId);
      assert(chunk, `${evaluation.id} references unknown chunk "${chunkId}"`);
      assert(
        chunk.locale === evaluation.locale,
        `${evaluation.id} expects a chunk in the wrong locale`,
      );
    }
  }

  return evaluations;
}

export function loadRetrievalEvals() {
  const evaluations = JSON.parse(readFileSync(evalsUrl, "utf8"));
  return validateRetrievalEvals(evaluations);
}

export function scoreRetrievalResults(results) {
  const positives = results.filter(
    (result) => result.expectedChunkIds.length > 0,
  );
  const passed = positives.filter((result) => result.matched).length;

  return {
    total: positives.length,
    passed,
    failed: positives.length - passed,
    recall: positives.length === 0 ? 0 : passed / positives.length,
  };
}
