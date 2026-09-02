import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_EVALUATION_HISTORY_MESSAGES,
  appendConversationHistory,
  evaluateConversation,
  loadConversationEvals,
  scoreConversationResults,
} from "../src/rag/conversationEvals.js";

test("conversation evaluations contain 10 scenarios and at least 20 turns", () => {
  const evaluations = loadConversationEvals();
  const turns = evaluations.conversations.flatMap(({ turns }) => turns);

  assert.equal(evaluations.conversations.length, 10);
  assert.equal(turns.length, 25);
  assert.ok(evaluations.conversations.every(({ turns }) => turns.length >= 2));
  assert.ok(turns.some(({ locale }) => locale === "en"));
  assert.ok(turns.some(({ locale }) => locale === "es"));
  assert.ok(turns.some(({ expectsFallback }) => expectsFallback));
});

test("conversation history retains only the latest 10 user and assistant messages", () => {
  let history = [];

  for (let turn = 1; turn <= 6; turn += 1) {
    history = appendConversationHistory(
      history,
      `Question ${turn}`,
      `Answer ${turn}`,
    );
  }

  assert.equal(history.length, MAX_EVALUATION_HISTORY_MESSAGES);
  assert.deepEqual(history[0], { role: "user", content: "Question 2" });
  assert.deepEqual(history.at(-1), {
    role: "assistant",
    content: "Answer 6",
  });
});

test("conversation runner passes prior turns to the next request", async () => {
  const receivedRequests = [];
  const conversation = {
    id: "mock-follow-up",
    scenario: "Test explicit history",
    turns: [
      {
        locale: "en",
        message: "What is the project?",
        expectedHistoryLength: 0,
        expectedSourceIds: ["project-overview-en"],
        requiredConcepts: [{ label: "React", anyOf: ["React"] }],
        expectsFallback: false,
      },
      {
        locale: "en",
        message: "What does it use?",
        expectedHistoryLength: 2,
        expectedSourceIds: ["project-overview-en"],
        requiredConcepts: [{ label: "React", anyOf: ["React"] }],
        expectsFallback: false,
      },
    ],
  };

  const result = await evaluateConversation(conversation, {
    answer: async (request) => {
      receivedRequests.push(request);
      return {
        content: "The project is built with React and it is documented.",
        sources: [{ id: "project-overview-en", itemId: "project" }],
      };
    },
  });

  assert.equal(result.passed, true);
  assert.deepEqual(receivedRequests[0].history, []);
  assert.deepEqual(receivedRequests[1].history, [
    { role: "user", content: "What is the project?" },
    {
      role: "assistant",
      content: "The project is built with React and it is documented.",
    },
  ]);
});

test("conversation runner reports an unexpected history length", async () => {
  const result = await evaluateConversation(
    {
      id: "history-mismatch",
      scenario: "Test failed history expectation",
      turns: [
        {
          locale: "en",
          message: "First question",
          expectedHistoryLength: 1,
          expectedSourceIds: [],
          requiredConcepts: [],
          expectsFallback: false,
        },
      ],
    },
    {
      answer: async () => ({
        content: "The answer is useful and it is available.",
        sources: [],
      }),
    },
  );

  assert.equal(result.passed, false);
  assert.equal(result.turns[0].checks.historyLength, false);
});

test("conversation scoring reports both scenario and turn pass rates", () => {
  assert.deepEqual(
    scoreConversationResults([
      { passed: true, turns: [{ passed: true }, { passed: true }] },
      { passed: false, turns: [{ passed: true }, { passed: false }] },
    ]),
    {
      conversations: 2,
      passedConversations: 1,
      conversationPassRate: 0.5,
      turns: 4,
      passedTurns: 3,
      turnPassRate: 0.75,
    },
  );
});
