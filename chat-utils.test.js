import test from "node:test";
import assert from "node:assert/strict";

import { buildRetrievalQuery } from "./chat-utils.js";

test("grounds a short follow-up in Rafa before retrieval", () => {
  assert.equal(
    buildRetrievalQuery("his last job"),
    "Information about Rafa relevant to this request: his last job",
  );
});

test("trims surrounding whitespace from the visitor's message", () => {
  assert.equal(
    buildRetrievalQuery("  favorite food  "),
    "Information about Rafa relevant to this request: favorite food",
  );
});
