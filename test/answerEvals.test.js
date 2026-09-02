import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateAnswerResult,
  loadAnswerEvals,
  scoreAnswerResults,
} from "../src/rag/answerEvals.js";

test("answer evaluations contain 10 English and 10 Spanish cases", () => {
  const evaluations = loadAnswerEvals();
  assert.equal(evaluations.cases.length, 20);
  assert.equal(evaluations.cases.filter(({ locale }) => locale === "en").length, 10);
  assert.equal(evaluations.cases.filter(({ locale }) => locale === "es").length, 10);
  assert.equal(
    evaluations.cases.filter(({ locale, judge }) => locale === "en" && judge).length,
    5,
  );
  assert.equal(
    evaluations.cases.filter(({ locale, judge }) => locale === "es" && judge).length,
    5,
  );
});

test("answer scoring checks facts, sources, language, and project order", () => {
  const evaluation = {
    locale: "en",
    expectedSourceIds: ["loadbalancer-overview-en"],
    expectedProjectOrder: ["loadbalancer", "scraper"],
    requiredConcepts: [
      { label: "routing", anyOf: ["round-robin"] },
      { label: "monitoring", anyOf: ["health checks"] },
    ],
    expectsFallback: false,
  };
  const result = evaluateAnswerResult(evaluation, {
    content: "The project uses round-robin routing and has automatic health checks.",
    sources: [
      { id: "loadbalancer-overview-en", itemId: "loadbalancer" },
      { id: "scraper-overview-en", itemId: "scraper" },
    ],
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.missingConcepts, []);
});

test("answer scoring reports missing concepts and incorrect source order", () => {
  const result = evaluateAnswerResult(
    {
      locale: "en",
      expectedSourceIds: ["loadbalancer-overview-en"],
      expectedProjectOrder: ["loadbalancer", "scraper"],
      requiredConcepts: [{ label: "health checks", anyOf: ["health checks"] }],
      expectsFallback: false,
    },
    {
      content: "The project is a useful portfolio example.",
      sources: [
        { id: "scraper-overview-en", itemId: "scraper" },
        { id: "loadbalancer-overview-en", itemId: "loadbalancer" },
      ],
    },
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.missingConcepts, ["health checks"]);
  assert.equal(result.checks.sources, true);
  assert.equal(result.checks.projectOrder, false);
});

test("fallback cases require the exact localized safe response", () => {
  const result = evaluateAnswerResult(
    {
      locale: "es",
      expectedSourceIds: [],
      requiredConcepts: [],
      expectsFallback: true,
    },
    {
      content: "Lo siento, no tengo esa información en el portafolio de Rafa. Puedes preguntarle directamente a Rafa.",
      sources: [],
    },
  );

  assert.equal(result.passed, true);
});

test("exact English fallback passes without generic language-word scoring", () => {
  const result = evaluateAnswerResult(
    {
      locale: "en",
      expectedSourceIds: [],
      requiredConcepts: [],
      expectsFallback: true,
    },
    {
      content: "Sorry, I don't have that information in Rafa's portfolio. Please ask Rafa directly.",
      sources: [],
    },
  );

  assert.equal(result.passed, true);
  assert.equal(result.checks.language, true);
});

test("answer pass rate is calculated across all cases", () => {
  assert.deepEqual(
    scoreAnswerResults([{ passed: true }, { passed: false }, { passed: true }]),
    { total: 3, passed: 2, passRate: 2 / 3 },
  );
});
