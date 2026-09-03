import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FALLBACK_ANSWERS } from "../chat/answer-generator.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_EVAL_PATH = path.resolve(moduleDirectory, "../../evals/answers.json");
const SUPPORTED_LOCALES = new Set(["en", "es"]);
const LANGUAGE_WORDS = {
  en: new Set(["and", "are", "for", "from", "has", "he", "his", "is", "the", "to", "with", "worked", "built"]),
  es: new Set(["con", "de", "desde", "el", "ella", "en", "es", "esta", "ha", "la", "las", "los", "para", "que", "su", "sus", "tiene", "trabajo", "un", "una", "y"]),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsPhrase(value, phrase) {
  return normalize(value).includes(normalize(phrase));
}

function hasExpectedLanguage(content, locale) {
  const tokens = normalize(content).split(" ").filter(Boolean);
  const requestedCount = tokens.filter((token) =>
    LANGUAGE_WORDS[locale].has(token),
  ).length;
  const otherLocale = locale === "en" ? "es" : "en";
  const otherCount = tokens.filter((token) =>
    LANGUAGE_WORDS[otherLocale].has(token),
  ).length;

  return requestedCount >= 2 && requestedCount >= otherCount;
}

export function validateAnswerEvals(evaluations) {
  assert(evaluations?.version === 1, "Answer eval version must be 1.");
  assert(Array.isArray(evaluations.cases), "Answer eval cases must be an array.");
  assert(evaluations.cases.length === 20, "Answer evals must contain exactly 20 cases.");

  const ids = new Set();
  const localeCounts = { en: 0, es: 0 };
  const judgeLocaleCounts = { en: 0, es: 0 };

  for (const [index, evaluation] of evaluations.cases.entries()) {
    const label = `cases[${index}]`;
    assert(typeof evaluation.id === "string" && evaluation.id, `${label}.id is required.`);
    assert(!ids.has(evaluation.id), `${label}.id must be unique.`);
    ids.add(evaluation.id);
    assert(SUPPORTED_LOCALES.has(evaluation.locale), `${label}.locale must be en or es.`);
    localeCounts[evaluation.locale] += 1;
    assert(typeof evaluation.category === "string" && evaluation.category, `${label}.category is required.`);
    assert(evaluation.judge === undefined || typeof evaluation.judge === "boolean", `${label}.judge must be boolean when provided.`);
    if (evaluation.judge) judgeLocaleCounts[evaluation.locale] += 1;
    assert(typeof evaluation.question === "string" && evaluation.question, `${label}.question is required.`);
    assert(Array.isArray(evaluation.expectedSourceIds), `${label}.expectedSourceIds must be an array.`);
    assert(Array.isArray(evaluation.requiredConcepts), `${label}.requiredConcepts must be an array.`);
    assert(typeof evaluation.expectsFallback === "boolean", `${label}.expectsFallback must be boolean.`);

    for (const [conceptIndex, concept] of evaluation.requiredConcepts.entries()) {
      assert(typeof concept.label === "string" && concept.label, `${label}.requiredConcepts[${conceptIndex}].label is required.`);
      assert(Array.isArray(concept.anyOf) && concept.anyOf.length > 0, `${label}.requiredConcepts[${conceptIndex}].anyOf must not be empty.`);
    }

    if (evaluation.expectsFallback) {
      assert(evaluation.requiredConcepts.length === 0, `${label} fallback cases cannot require concepts.`);
    }

    if (evaluation.expectedProjectOrder !== undefined) {
      assert(Array.isArray(evaluation.expectedProjectOrder) && evaluation.expectedProjectOrder.length > 0, `${label}.expectedProjectOrder must not be empty.`);
    }
  }

  assert(localeCounts.en === 10, "Answer evals must contain 10 English cases.");
  assert(localeCounts.es === 10, "Answer evals must contain 10 Spanish cases.");
  assert(judgeLocaleCounts.en === 5, "Answer evals must select 5 English judge cases.");
  assert(judgeLocaleCounts.es === 5, "Answer evals must select 5 Spanish judge cases.");
  return evaluations;
}

export function loadAnswerEvals(filePath = DEFAULT_EVAL_PATH) {
  return validateAnswerEvals(JSON.parse(fs.readFileSync(filePath, "utf8")));
}

export function evaluateAnswerResult(evaluation, result) {
  const content = result?.content?.trim() ?? "";
  const sourceIds = (result?.sources ?? []).map((source) => source.id);
  const itemIds = (result?.sources ?? []).map((source) => source.itemId);
  const missingConcepts = evaluation.requiredConcepts
    .filter((concept) => !concept.anyOf.some((phrase) => containsPhrase(content, phrase)))
    .map((concept) => concept.label);
  const sourceMatched =
    evaluation.expectedSourceIds.length === 0 ||
    evaluation.expectedSourceIds.some((id) => sourceIds.includes(id));
  const expectedProjectOrder = evaluation.expectedProjectOrder ?? [];
  const actualProjectOrder = itemIds.filter((id) => expectedProjectOrder.includes(id));
  const projectOrderMatched =
    expectedProjectOrder.length === 0 ||
    expectedProjectOrder.every((id, index) => actualProjectOrder[index] === id);
  const fallbackMatched = evaluation.expectsFallback
    ? content === FALLBACK_ANSWERS[evaluation.locale]
    : content !== FALLBACK_ANSWERS[evaluation.locale];
  const checks = {
    nonEmpty: content.length > 0,
    language: evaluation.expectsFallback
      ? fallbackMatched
      : hasExpectedLanguage(content, evaluation.locale),
    fallback: fallbackMatched,
    concepts: missingConcepts.length === 0,
    sources: sourceMatched,
    projectOrder: projectOrderMatched,
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    missingConcepts,
    sourceIds,
    itemIds,
    content,
  };
}

export function scoreAnswerResults(results) {
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  return { total, passed, passRate: total === 0 ? 0 : passed / total };
}
