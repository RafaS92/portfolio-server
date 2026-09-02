import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateAnswerResult } from "./answerEvals.js";
import {
  answerPortfolioQuestion,
  parseChatRequest,
} from "../services/ragChat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_EVAL_PATH = path.resolve(
  __dirname,
  "../../evals/conversations.json",
);
export const MAX_EVALUATION_HISTORY_MESSAGES = 10;
const SUPPORTED_LOCALES = new Set(["en", "es"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateConversationEvals(evaluations) {
  assert(evaluations?.version === 1, "Conversation eval version must be 1.");
  assert(
    Array.isArray(evaluations.conversations),
    "Conversation evals must contain a conversations array.",
  );
  assert(
    evaluations.conversations.length === 10,
    "Conversation evals must contain exactly 10 conversations.",
  );

  const conversationIds = new Set();
  let totalTurns = 0;

  for (const [conversationIndex, conversation] of
    evaluations.conversations.entries()) {
    const label = `conversations[${conversationIndex}]`;
    assert(
      typeof conversation.id === "string" && conversation.id,
      `${label}.id is required.`,
    );
    assert(
      !conversationIds.has(conversation.id),
      `${label}.id must be unique.`,
    );
    conversationIds.add(conversation.id);
    assert(
      typeof conversation.scenario === "string" && conversation.scenario,
      `${label}.scenario is required.`,
    );
    assert(
      Array.isArray(conversation.turns) && conversation.turns.length >= 2,
      `${label}.turns must contain at least two turns.`,
    );

    for (const [turnIndex, turn] of conversation.turns.entries()) {
      const turnLabel = `${label}.turns[${turnIndex}]`;
      totalTurns += 1;
      assert(
        SUPPORTED_LOCALES.has(turn.locale),
        `${turnLabel}.locale must be en or es.`,
      );
      assert(
        typeof turn.message === "string" && turn.message,
        `${turnLabel}.message is required.`,
      );
      assert(
        Array.isArray(turn.expectedSourceIds),
        `${turnLabel}.expectedSourceIds must be an array.`,
      );
      assert(
        Array.isArray(turn.requiredConcepts),
        `${turnLabel}.requiredConcepts must be an array.`,
      );
      for (const [conceptIndex, concept] of turn.requiredConcepts.entries()) {
        assert(
          typeof concept.label === "string" && concept.label,
          `${turnLabel}.requiredConcepts[${conceptIndex}].label is required.`,
        );
        assert(
          Array.isArray(concept.anyOf) && concept.anyOf.length > 0,
          `${turnLabel}.requiredConcepts[${conceptIndex}].anyOf must not be empty.`,
        );
      }
      assert(
        typeof turn.expectsFallback === "boolean",
        `${turnLabel}.expectsFallback must be boolean.`,
      );
      if (turn.expectsFallback) {
        assert(
          turn.requiredConcepts.length === 0,
          `${turnLabel} fallback turns cannot require concepts.`,
        );
      }
      if (turn.expectedProjectOrder !== undefined) {
        assert(
          Array.isArray(turn.expectedProjectOrder) &&
            turn.expectedProjectOrder.length > 0,
          `${turnLabel}.expectedProjectOrder must not be empty.`,
        );
      }
      if (turn.expectedHistoryLength !== undefined) {
        assert(
          Number.isInteger(turn.expectedHistoryLength) &&
            turn.expectedHistoryLength >= 0 &&
            turn.expectedHistoryLength <= MAX_EVALUATION_HISTORY_MESSAGES,
          `${turnLabel}.expectedHistoryLength must be between 0 and 10.`,
        );
      }
    }
  }

  assert(totalTurns >= 20, "Conversation evals must contain at least 20 turns.");
  return evaluations;
}

export function loadConversationEvals(filePath = DEFAULT_EVAL_PATH) {
  return validateConversationEvals(
    JSON.parse(fs.readFileSync(filePath, "utf8")),
  );
}

export function appendConversationHistory(history, message, answer) {
  return [
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: answer },
  ].slice(-MAX_EVALUATION_HISTORY_MESSAGES);
}

export async function evaluateConversation(
  conversation,
  { answer = answerPortfolioQuestion } = {},
) {
  let history = [];
  const turns = [];

  for (const [turnIndex, turn] of conversation.turns.entries()) {
    const request = parseChatRequest({
      message: turn.message,
      locale: turn.locale,
      history,
    });
    const response = await answer(request);
    const answerEvaluation = evaluateAnswerResult(
      { ...turn, question: turn.message },
      response,
    );
    const historyLengthMatched =
      turn.expectedHistoryLength === undefined ||
      request.history.length === turn.expectedHistoryLength;

    turns.push({
      ...turn,
      turnNumber: turnIndex + 1,
      historyLength: request.history.length,
      response,
      ...answerEvaluation,
      checks: {
        ...answerEvaluation.checks,
        historyLength: historyLengthMatched,
      },
      passed: answerEvaluation.passed && historyLengthMatched,
    });

    history = appendConversationHistory(
      history,
      turn.message,
      response.content,
    );
  }

  return {
    id: conversation.id,
    scenario: conversation.scenario,
    turns,
    passed: turns.every((turn) => turn.passed),
    finalHistory: history,
  };
}

export function scoreConversationResults(conversations) {
  const turns = conversations.flatMap((conversation) => conversation.turns);
  const passedTurns = turns.filter((turn) => turn.passed).length;
  const passedConversations = conversations.filter(
    (conversation) => conversation.passed,
  ).length;

  return {
    conversations: conversations.length,
    passedConversations,
    conversationPassRate:
      conversations.length === 0
        ? 0
        : passedConversations / conversations.length,
    turns: turns.length,
    passedTurns,
    turnPassRate: turns.length === 0 ? 0 : passedTurns / turns.length,
  };
}
