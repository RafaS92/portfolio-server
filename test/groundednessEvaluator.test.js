import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateGroundedAnswer,
  scoreGroundednessGrade,
  validateGroundednessGrade,
} from "../src/rag/groundednessEvaluator.js";

function validGrade(overrides = {}) {
  return {
    groundednessScore: 4,
    correctnessScore: 4,
    relevanceScore: 4,
    completenessScore: 3,
    unsupportedClaims: [],
    missingFacts: [],
    explanation: "Every factual claim is supported by the supplied evidence.",
    ...overrides,
  };
}

test("groundedness grades require bounded scores and structured findings", () => {
  assert.deepEqual(validateGroundednessGrade(validGrade()), validGrade());
  assert.throws(
    () => validateGroundednessGrade(validGrade({ groundednessScore: 5 })),
    /between 0 and 4/,
  );
  assert.throws(
    () => validateGroundednessGrade(validGrade({ unsupportedClaims: "none" })),
    /array of strings/,
  );
});

test("groundedness scoring rejects unsupported claims even with high scores", () => {
  assert.equal(scoreGroundednessGrade(validGrade()).passed, true);

  const result = scoreGroundednessGrade(
    validGrade({ unsupportedClaims: ["Rafa led a team of 20 engineers."] }),
  );
  assert.equal(result.passed, false);
  assert.equal(result.checks.noUnsupportedClaims, false);
});

test("groundedness scoring uses explicit dimension thresholds", () => {
  const result = scoreGroundednessGrade(
    validGrade({ completenessScore: 1 }),
  );
  assert.equal(result.passed, false);
  assert.equal(result.checks.completeness, false);
});

test("model evaluator sends exact evidence as untrusted data and requests strict JSON", async () => {
  let request;
  const client = {
    responses: {
      async create(input) {
        request = input;
        return {
          output_text: JSON.stringify(validGrade()),
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      },
    },
  };
  const result = await evaluateGroundedAnswer(
    {
      question: "What did Rafa build?",
      answer: "He built a load balancer.",
      locale: "en",
      hits: [
        {
          id: "loadbalancer-overview-en",
          chunk_text: "Rafa built a load balancer.",
        },
      ],
    },
    client,
  );

  assert.deepEqual(result.grade, validGrade());
  assert.deepEqual(result.usage, { input_tokens: 100, output_tokens: 50 });
  assert.equal(request.store, false);
  assert.equal(request.temperature, 0);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.match(request.input, /loadbalancer-overview-en/);
  assert.match(request.input, /Rafa built a load balancer/);
});

test("model evaluator rejects malformed model output", async () => {
  const client = {
    responses: {
      async create() {
        return { output_text: "not-json" };
      },
    },
  };

  await assert.rejects(
    evaluateGroundedAnswer(
      {
        question: "What did Rafa build?",
        answer: "A project.",
        locale: "en",
        hits: [],
      },
      client,
    ),
    /invalid groundedness grade/,
  );
});
