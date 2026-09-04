import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAnswerGenerator,
  ESTIMATE_ANSWERS,
  enforceFollowUpScope,
  formatRetrievedContext,
  OUT_OF_SCOPE_ANSWERS,
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

test("estimate inquiries return a localized answer without calling OpenAI", async () => {
  const generateGroundedAnswer = createAnswerGenerator({
    openAIClient: {
      responses: {
        async create() {
          assert.fail("estimate inquiries should not call OpenAI");
        },
      },
    },
    model: "gpt-4o-mini",
  });

  assert.equal(
    await generateGroundedAnswer({
      message: "Can I get an estimate for a website?",
      locale: "en",
      hits: [],
      estimateInquiry: true,
    }),
    ESTIMATE_ANSWERS.en,
  );
  assert.equal(
    await generateGroundedAnswer({
      message: "¿Cuánto costaría desarrollar una aplicación?",
      locale: "es",
      hits: [],
      estimateInquiry: true,
    }),
    ESTIMATE_ANSWERS.es,
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
  assert.match(request.instructions, /clearly unrelated to Rafa or his portfolio/);
  assert.match(request.instructions, /Rafael Salvador Valdez Vanegas/);
  assert.match(request.instructions, /obvious misspellings of Rafa or Rafael/);
  assert.match(request.instructions, new RegExp(OUT_OF_SCOPE_ANSWERS.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(request.instructions, /interpret omitted human subjects and pronouns/);
  assert.match(request.instructions, /replies with a short yes or no/);
  assert.match(request.instructions, /Never ask a follow-up question about Rafa's hobbies/);
  assert.match(request.instructions, /Every question you ask must explicitly contain the name "Rafa"/);
  assert.match(request.input.at(-1).content, /PORTFOLIO CONTEXT/);
  assert.match(request.input.at(-1).content, /Who is Rafa\?/);
});

test("out-of-scope redirects are localized and remain unchanged", () => {
  assert.equal(
    enforceFollowUpScope(OUT_OF_SCOPE_ANSWERS.en, "en"),
    "Sorry, I can't answer that, but I can tell you about Rafa. Tell me what you'd like to know.",
  );
  assert.equal(
    enforceFollowUpScope(OUT_OF_SCOPE_ANSWERS.es, "es"),
    "Lo siento, no puedo responder eso, pero puedo contarte sobre Rafa. Dime qué te gustaría saber.",
  );
});

test("visitor-directed follow-up questions are removed from grounded answers", () => {
  assert.equal(
    enforceFollowUpScope(
      "Rafa's favorite foods include tacos, pho, wings, and pozole. What is your favorite food?",
      "en",
    ),
    "Rafa's favorite foods include tacos, pho, wings, and pozole.",
  );
  assert.equal(
    enforceFollowUpScope(
      "A Rafa le gustan los tacos y el pozole. ¿Cuál es tu comida favorita?",
      "es",
    ),
    "A Rafa le gustan los tacos y el pozole.",
  );
});

test("professional follow-up questions explicitly about Rafa are preserved", () => {
  assert.equal(
    enforceFollowUpScope(
      "Rafa enjoys cooking Mexican food. Would you like to explore Rafa's software projects?",
      "en",
    ),
    "Rafa enjoys cooking Mexican food. Would you like to explore Rafa's software projects?",
  );
});

test("follow-up questions about Rafa's hobbies are removed", () => {
  assert.equal(
    enforceFollowUpScope(
      "Rafa enjoys cooking Mexican food. Would you like to know more about Rafa's cooking experience?",
      "en",
    ),
    "Rafa enjoys cooking Mexican food.",
  );
});

test("an answer containing only a visitor-directed question becomes the fallback", () => {
  assert.equal(
    enforceFollowUpScope("What is your favorite food?", "en"),
    "Sorry, I don't have that information in Rafa's portfolio. Please ask Rafa directly.",
  );
});
