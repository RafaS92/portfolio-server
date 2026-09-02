import { loadConversationEvals } from "../src/rag/conversationEvals.js";

try {
  const evaluations = loadConversationEvals();
  const turns = evaluations.conversations.reduce(
    (total, conversation) => total + conversation.turns.length,
    0,
  );
  console.log(
    `Conversation evaluations are valid: ${evaluations.conversations.length} ` +
      `conversations and ${turns} turns.`,
  );
} catch (error) {
  console.error(`Conversation evaluation validation failed: ${error.message}`);
  process.exitCode = 1;
}
