import { parseChatRequest } from "../src/chat/request.js";
import { createChatService } from "../src/chat/service.js";
import {
  evaluateAnswerResult,
  loadAnswerEvals,
  scoreAnswerResults,
} from "../src/evaluation/answers.js";
import {
  DEFAULT_GROUNDEDNESS_THRESHOLDS,
  createGroundednessEvaluator,
  scoreGroundednessGrade,
} from "../src/evaluation/groundedness.js";
import { createChatRuntime } from "./runtime.js";

function parseRate(name, fallback) {
  const value = Number.parseFloat(process.env[name] ?? String(fallback));
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1.`);
  }
  return value;
}

function parseScore(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < 0 || value > 4) {
    throw new Error(`${name} must be an integer between 0 and 4.`);
  }
  return value;
}

function average(results, field) {
  if (results.length === 0) return 0;
  return results.reduce((sum, result) => sum + result.grade[field], 0) / results.length;
}

try {
  const runtime = createChatRuntime();
  const evaluateGroundedAnswer = createGroundednessEvaluator({
    openAIClient: runtime.openAIClient,
    model: runtime.config.OPENAI_EVAL_MODEL,
  });
  const minimumPassRate = parseRate("EVAL_MIN_JUDGE_PASS_RATE", 0.8);
  const thresholds = {
    groundedness: parseScore("EVAL_MIN_GROUNDEDNESS", DEFAULT_GROUNDEDNESS_THRESHOLDS.groundedness),
    correctness: parseScore("EVAL_MIN_CORRECTNESS", DEFAULT_GROUNDEDNESS_THRESHOLDS.correctness),
    relevance: parseScore("EVAL_MIN_RELEVANCE", DEFAULT_GROUNDEDNESS_THRESHOLDS.relevance),
    completeness: parseScore("EVAL_MIN_COMPLETENESS", DEFAULT_GROUNDEDNESS_THRESHOLDS.completeness),
  };
  const evaluations = loadAnswerEvals().cases.filter(({ judge }) => judge);
  const results = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (const evaluation of evaluations) {
    const request = parseChatRequest({
      message: evaluation.question,
      locale: evaluation.locale,
      history: evaluation.history ?? [],
    });
    let generationInput;
    const answerPortfolioQuestion = createChatService({
      retrievalPolicy: runtime.retrievalPolicy,
      searchPortfolio: runtime.searchPortfolio,
      async generateAnswer(input, options) {
        generationInput = input;
        return runtime.generateAnswer(input, options);
      },
    });
    const response = await answerPortfolioQuestion(request);
    const deterministic = evaluateAnswerResult(evaluation, response);
    const { grade, usage } = await evaluateGroundedAnswer({
      question: evaluation.question,
      answer: response.content,
      locale: evaluation.locale,
      hits: generationInput.hits,
    });
    const modelScore = scoreGroundednessGrade(grade, thresholds);
    const result = {
      ...evaluation,
      grade,
      deterministic,
      modelScore,
      passed: deterministic.passed && modelScore.passed,
    };
    results.push(result);
    inputTokens += usage?.input_tokens ?? 0;
    outputTokens += usage?.output_tokens ?? 0;

    console.log(
      `${result.passed ? "PASS" : "FAIL"} ${evaluation.id} ` +
      `(G${grade.groundednessScore} C${grade.correctnessScore} ` +
      `R${grade.relevanceScore} X${grade.completenessScore})`,
    );
    if (!result.passed) {
      const failedModelChecks = Object.entries(modelScore.checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
      const failedDeterministicChecks = Object.entries(deterministic.checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
      if (failedDeterministicChecks.length > 0) {
        console.log(`  deterministic: ${failedDeterministicChecks.join(", ")}`);
      }
      if (failedModelChecks.length > 0) {
        console.log(`  model grader: ${failedModelChecks.join(", ")}`);
      }
      if (grade.unsupportedClaims.length > 0) {
        console.log(`  unsupported: ${grade.unsupportedClaims.join(" | ")}`);
      }
      if (grade.missingFacts.length > 0) {
        console.log(`  missing: ${grade.missingFacts.join(" | ")}`);
      }
      console.log(`  explanation: ${grade.explanation}`);
      console.log(`  answer: ${response.content}`);
    }
  }

  const score = scoreAnswerResults(results);
  const english = scoreAnswerResults(results.filter(({ locale }) => locale === "en"));
  const spanish = scoreAnswerResults(results.filter(({ locale }) => locale === "es"));

  console.log(`\nGroundedness judge pass rate: ${(score.passRate * 100).toFixed(1)}% (${score.passed}/${score.total})`);
  console.log(`English: ${(english.passRate * 100).toFixed(1)}% (${english.passed}/${english.total})`);
  console.log(`Spanish: ${(spanish.passRate * 100).toFixed(1)}% (${spanish.passed}/${spanish.total})`);
  console.log(
    `Average scores: groundedness ${average(results, "groundednessScore").toFixed(2)}, ` +
    `correctness ${average(results, "correctnessScore").toFixed(2)}, ` +
    `relevance ${average(results, "relevanceScore").toFixed(2)}, ` +
    `completeness ${average(results, "completenessScore").toFixed(2)}`,
  );
  console.log(`Judge tokens: ${inputTokens} input, ${outputTokens} output`);
  console.log(`Minimum pass rate: ${(minimumPassRate * 100).toFixed(1)}%`);

  if (score.passRate < minimumPassRate) process.exitCode = 1;
} catch (error) {
  console.error(`Groundedness evaluation failed: ${error.message}`);
  process.exitCode = 1;
}
