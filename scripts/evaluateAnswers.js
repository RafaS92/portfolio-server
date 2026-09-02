import { loadAnswerEvals, evaluateAnswerResult, scoreAnswerResults } from "../src/rag/answerEvals.js";
import { answerPortfolioQuestion, parseChatRequest } from "../src/services/ragChat.js";

const minimumPassRate = Number.parseFloat(process.env.EVAL_MIN_ANSWER_PASS_RATE ?? "0.9");

if (!Number.isFinite(minimumPassRate) || minimumPassRate < 0 || minimumPassRate > 1) {
  console.error("EVAL_MIN_ANSWER_PASS_RATE must be a number between 0 and 1.");
  process.exit(1);
}

try {
  const evaluations = loadAnswerEvals();
  const results = [];

  for (const evaluation of evaluations.cases) {
    const request = parseChatRequest({
      message: evaluation.question,
      locale: evaluation.locale,
      history: evaluation.history ?? [],
    });
    const response = await answerPortfolioQuestion(request);
    const result = evaluateAnswerResult(evaluation, response);
    results.push({ ...evaluation, ...result });

    const status = result.passed ? "PASS" : "FAIL";
    console.log(`${status} ${evaluation.id}`);
    if (!result.passed) {
      const failedChecks = Object.entries(result.checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
      console.log(`  failed checks: ${failedChecks.join(", ")}`);
      if (result.missingConcepts.length > 0) {
        console.log(`  missing concepts: ${result.missingConcepts.join(", ")}`);
      }
      console.log(`  sources: ${result.sourceIds.join(", ") || "none"}`);
      console.log(`  answer: ${result.content}`);
    }
  }

  const score = scoreAnswerResults(results);
  const english = scoreAnswerResults(results.filter((result) => result.locale === "en"));
  const spanish = scoreAnswerResults(results.filter((result) => result.locale === "es"));

  console.log(`\nAnswer pass rate: ${(score.passRate * 100).toFixed(1)}% (${score.passed}/${score.total})`);
  console.log(`English: ${(english.passRate * 100).toFixed(1)}% (${english.passed}/${english.total})`);
  console.log(`Spanish: ${(spanish.passRate * 100).toFixed(1)}% (${spanish.passed}/${spanish.total})`);
  console.log(`Minimum required: ${(minimumPassRate * 100).toFixed(1)}%`);

  if (score.passRate < minimumPassRate || english.passRate < minimumPassRate || spanish.passRate < minimumPassRate) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Answer evaluation failed: ${error.message}`);
  process.exitCode = 1;
}
