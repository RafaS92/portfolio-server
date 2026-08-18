import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPortfolio } from "../src/content/portfolio.js";
import {
  createPortfolioChunks,
  estimateTokens,
} from "../src/rag/chunkPortfolio.js";

test("portfolio content passes validation", () => {
  const portfolio = loadPortfolio();

  assert.equal(portfolio.version, 1);
  assert.ok(portfolio.items.length > 0);
});

test("each semantic section creates English and Spanish chunks", () => {
  const portfolio = loadPortfolio();
  const sectionCount = portfolio.items.reduce(
    (total, item) => total + item.sections.length,
    0,
  );
  const chunks = createPortfolioChunks(portfolio);

  assert.equal(chunks.length, sectionCount * 2);

  for (const item of portfolio.items) {
    for (const section of item.sections) {
      assert.ok(
        chunks.some((chunk) => chunk.id === `${item.id}-${section.id}-en`),
      );
      assert.ok(
        chunks.some((chunk) => chunk.id === `${item.id}-${section.id}-es`),
      );
    }
  }
});

test("chunks have unique stable IDs and retrieval metadata", () => {
  const chunks = createPortfolioChunks();
  const ids = new Set(chunks.map((chunk) => chunk.id));

  assert.equal(ids.size, chunks.length);

  for (const chunk of chunks) {
    assert.match(chunk.id, /^[a-z0-9-]+-(en|es)$/);
    assert.ok(["en", "es"].includes(chunk.locale));
    assert.ok(chunk.itemId);
    assert.ok(chunk.sectionId);
    assert.ok(chunk.contentType);
    assert.ok(chunk.title);
    assert.ok(chunk.topic);
    assert.ok(Array.isArray(chunk.tags));
    assert.ok(Array.isArray(chunk.technologies));
  }
});

test("chunks contain identifying context and stay within the initial size limit", () => {
  const chunks = createPortfolioChunks();

  for (const chunk of chunks) {
    assert.ok(chunk.text.startsWith(chunk.title));
    assert.equal(chunk.estimatedTokens, estimateTokens(chunk.text));
    assert.ok(
      chunk.estimatedTokens >= 20,
      `${chunk.id} lacks enough standalone context at ${chunk.estimatedTokens} estimated tokens`,
    );
    assert.ok(
      chunk.estimatedTokens <= 350,
      `${chunk.id} is too large at ${chunk.estimatedTokens} estimated tokens`,
    );
  }
});
