import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAnswerGenerator,
  formatRetrievedContext,
} from "../src/chat/answer-generator.js";

test("retrieved chunks are clearly separated in model context", () => {
  const context = formatRetrievedContext([
    { id: "one-en", chunk_text: "First fact." },
    { id: "two-en", chunk_text: "Second fact." },
  ]);

  assert.equal(
    context,
    "[Portfolio source 1: one-en]\nFirst fact.\n\n[Portfolio source 2: two-en]\nSecond fact.",
  );
});

test("grounded generation uses the Responses API without storing responses", async () => {
  let request;
  const client = {
    responses: {
      async create(options) {
        request = options;
        return { output_text: "Rafa is a full-stack engineer." };
      },
    },
  };

  const generateGroundedAnswer = createAnswerGenerator({
    openAIClient: client,
    model: "gpt-4o-mini",
  });
  const answer = await generateGroundedAnswer({
      message: "Who is Rafa?",
      locale: "en",
      history: [{ role: "user", content: "Hello" }],
      hits: [
        {
          id: "profile-overview-engineering-interests-en",
          chunk_text: "Rafa is a full-stack engineer.",
        },
      ],
    });

  assert.equal(answer, "Rafa is a full-stack engineer.");
  assert.equal(request.store, false);
  assert.equal(request.temperature, 0.2);
  assert.match(request.instructions, /Use only facts supported/);
  assert.match(request.input.at(-1).content, /PORTFOLIO CONTEXT/);
  assert.match(request.input.at(-1).content, /Who is Rafa\?/);
});
