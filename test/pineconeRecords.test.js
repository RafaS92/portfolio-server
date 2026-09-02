import assert from "node:assert/strict";
import { test } from "node:test";
import { createPortfolioChunks } from "../src/portfolio/chunks.js";
import {
  PINECONE_TEXT_FIELD,
  toPineconeRecord,
} from "../src/portfolio/pinecone-records.js";

test("portfolio chunks become flat Pinecone integrated-embedding records", () => {
  const chunk = createPortfolioChunks().find(
    (candidate) => candidate.organization === null,
  );
  const record = toPineconeRecord(chunk);

  assert.equal(record._id, chunk.id);
  assert.equal(record[PINECONE_TEXT_FIELD], chunk.text);
  assert.equal(record.item_id, chunk.itemId);
  assert.equal(record.locale, chunk.locale);
  assert.deepEqual(record.technologies, chunk.technologies);
  assert.ok(!Object.values(record).includes(null));
  assert.ok(!("organization" in record));
});
