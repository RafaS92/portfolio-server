import { searchPortfolio } from "../src/rag/pineconeStore.js";
import {
  loadRetrievalEvals,
  scoreRetrievalResults,
} from "../src/rag/retrievalEvals.js";

const TOP_K = 3;
const minimumRecall = Number.parseFloat(process.env.EVAL_MIN_RECALL ?? "0.9");

if (!Number.isFinite(minimumRecall) || minimumRecall < 0 || minimumRecall > 1) {
  console.error("EVAL_MIN_RECALL must be a number between 0 and 1.");
  process.exit(1);
}

try {
  const evaluations = loadRetrievalEvals();
  const results = [];

  for (const evaluation of evaluations.cases) {
    const hits = await searchPortfolio(evaluation.question, {
      locale: evaluation.locale,
      topK: TOP_K,
    });
    const retrievedIds = hits.map((hit) => hit.id);
    const matched = evaluation.expectedChunkIds.some((id) =>
      retrievedIds.includes(id),
    );

    results.push({
      ...evaluation,
      retrievedIds,
      matched,
      topScore: hits[0]?.score ?? null,
    });

    if (evaluation.expectedChunkIds.length > 0 && !matched) {
      console.log(`FAIL ${evaluation.id}`);
      console.log(`  expected: ${evaluation.expectedChunkIds.join(", ")}`);
      console.log(`  received: ${retrievedIds.join(", ") || "none"}`);
    }
  }

  const score = scoreRetrievalResults(results);
  const negativeResults = results.filter(
    (result) => result.expectedChunkIds.length === 0,
  );

  console.log(
    `\nRecall@${TOP_K}: ${(score.recall * 100).toFixed(1)}% (${score.passed}/${score.total})`,
  );
  console.log(`Minimum required: ${(minimumRecall * 100).toFixed(1)}%`);

  for (const result of negativeResults) {
    const scoreLabel =
      result.topScore === null ? "no result" : result.topScore.toFixed(4);
    console.log(`Out-of-scope ${result.id}: top score ${scoreLabel}`);
  }

  if (score.recall < minimumRecall) process.exitCode = 1;
} catch (error) {
  console.error(`Retrieval evaluation failed: ${error.message}`);
  process.exitCode = 1;
}
