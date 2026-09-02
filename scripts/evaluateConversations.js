import {
  evaluateConversation,
  loadConversationEvals,
  scoreConversationResults,
} from "../src/rag/conversationEvals.js";

const minimumTurnPassRate = Number.parseFloat(
  process.env.EVAL_MIN_CONVERSATION_TURN_PASS_RATE ?? "0.9",
);

if (
  !Number.isFinite(minimumTurnPassRate) ||
  minimumTurnPassRate < 0 ||
  minimumTurnPassRate > 1
) {
  console.error(
    "EVAL_MIN_CONVERSATION_TURN_PASS_RATE must be a number between 0 and 1.",
  );
  process.exit(1);
}

try {
  const evaluations = loadConversationEvals();
  const results = [];

  for (const conversation of evaluations.conversations) {
    const result = await evaluateConversation(conversation);
    results.push(result);
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id}`);

    for (const turn of result.turns.filter(({ passed }) => !passed)) {
      const failedChecks = Object.entries(turn.checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
      console.log(`  turn ${turn.turnNumber}: ${turn.message}`);
      console.log(`  failed checks: ${failedChecks.join(", ")}`);
      if (turn.missingConcepts.length > 0) {
        console.log(`  missing concepts: ${turn.missingConcepts.join(", ")}`);
      }
      console.log(`  history messages: ${turn.historyLength}`);
      console.log(`  sources: ${turn.sourceIds.join(", ") || "none"}`);
      console.log(`  answer: ${turn.content}`);
    }
  }

  const score = scoreConversationResults(results);
  console.log(
    `\nConversation pass rate: ${(score.conversationPassRate * 100).toFixed(1)}% ` +
      `(${score.passedConversations}/${score.conversations})`,
  );
  console.log(
    `Turn pass rate: ${(score.turnPassRate * 100).toFixed(1)}% ` +
      `(${score.passedTurns}/${score.turns})`,
  );
  console.log(
    `Minimum turn pass rate: ${(minimumTurnPassRate * 100).toFixed(1)}%`,
  );

  if (score.turnPassRate < minimumTurnPassRate) process.exitCode = 1;
} catch (error) {
  console.error(`Conversation evaluation failed: ${error.message}`);
  process.exitCode = 1;
}
