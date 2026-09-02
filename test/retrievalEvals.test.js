import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadRetrievalEvals,
  scoreRetrievalResults,
} from "../src/rag/retrievalEvals.js";

test("retrieval evaluations reference valid same-language chunks", () => {
  const evaluations = loadRetrievalEvals();

  assert.equal(evaluations.cases.length, 62);
});

test("positive retrieval evaluations are balanced by language", () => {
  const cases = loadRetrievalEvals().cases.filter(
    (evaluation) => evaluation.expectedChunkIds.length > 0,
  );
  const englishCases = cases.filter(
    (evaluation) => evaluation.locale === "en",
  );
  const spanishCases = cases.filter(
    (evaluation) => evaluation.locale === "es",
  );

  assert.equal(englishCases.length, 30);
  assert.equal(spanishCases.length, 30);
});

test("project retrieval evaluations cover all projects in both languages", () => {
  const projectCases = loadRetrievalEvals().cases.filter(
    (evaluation) => evaluation.category === "project",
  );

  assert.equal(projectCases.length, 30);
  assert.equal(
    new Set(
      projectCases.flatMap((evaluation) => evaluation.expectedChunkIds),
    ).size,
    30,
  );
});

test("retrieval evaluations include out-of-scope questions", () => {
  const negativeCases = loadRetrievalEvals().cases.filter(
    (evaluation) => evaluation.expectedChunkIds.length === 0,
  );

  assert.equal(negativeCases.length, 2);
  assert.deepEqual(
    new Set(negativeCases.map((evaluation) => evaluation.locale)),
    new Set(["en", "es"]),
  );
});

test("retrieval scoring measures positive cases and excludes negatives", () => {
  const score = scoreRetrievalResults([
    { expectedChunkIds: ["one"], matched: true },
    { expectedChunkIds: ["two"], matched: false },
    { expectedChunkIds: [], matched: false },
  ]);

  assert.deepEqual(score, {
    total: 2,
    passed: 1,
    failed: 1,
    recall: 0.5,
  });
});
