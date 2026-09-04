import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPortfolio } from "../src/portfolio/content.js";
import {
  createPortfolioChunks,
  estimateTokens,
} from "../src/portfolio/chunks.js";

test("portfolio content passes validation", () => {
  const portfolio = loadPortfolio();

  assert.equal(portfolio.version, 1);
  assert.ok(portfolio.items.length > 0);
});

test("portfolio knowledge identifies Rafael and Rafa as the same person", () => {
  const profile = loadPortfolio().items.find(
    (item) => item.id === "profile-overview",
  );
  const identity = profile.sections.find((section) => section.id === "identity");

  assert.match(identity.text.en, /Rafael Salvador Valdez Vanegas/);
  assert.match(identity.text.en, /Rafa and Rafael both refer to the same person/);
  assert.match(identity.text.es, /Rafa y Rafael se refieren a la misma persona/);
});

test("portfolio knowledge contains all 15 published project IDs", () => {
  const expectedProjectIds = new Set([
    "loadbalancer",
    "scraper",
    "website-creation-workflow",
    "rafaglot",
    "eo-pages",
    "chillflix",
    "hermes",
    "sell-it",
    "shopper",
    "picpock",
    "master-query",
    "budget-app",
    "pet-life",
    "vidly",
    "shoptastic",
  ]);
  const projectItems = loadPortfolio().items.filter(
    (item) => item.type === "project",
  );

  assert.equal(projectItems.length, 15);
  assert.deepEqual(
    new Set(projectItems.map((project) => project.id)),
    expectedProjectIds,
  );
});

test("portfolio knowledge identifies independent AI development as the current role", () => {
  const experiences = loadPortfolio().items.filter(
    (item) => item.type === "experience",
  );
  const currentRole = experiences[0];

  assert.equal(currentRole.id, "experience-independent-contractor");
  assert.equal(currentRole.startDate, "2025-09");
  assert.equal(currentRole.endDate, undefined);
  assert.deepEqual(
    currentRole.sections.map((section) => section.id),
    [
      "ai-applications",
      "agent-automation",
      "generative-media",
      "client-websites",
    ],
  );

  const currentRoleChunks = createPortfolioChunks().filter(
    (chunk) => chunk.itemId === currentRole.id,
  );
  assert.equal(currentRoleChunks.length, 8);
  assert.ok(currentRoleChunks.every((chunk) => chunk.endDate === null));
  assert.ok(
    currentRoleChunks
      .find((chunk) => chunk.id.endsWith("ai-applications-en"))
      .text.includes("to present"),
  );
});

test("every project has a unique archiveOrder importance ranking", () => {
  const projects = loadPortfolio().items
    .filter((item) => item.type === "project")
    .sort((left, right) => left.archiveOrder - right.archiveOrder);

  assert.deepEqual(
    projects.slice(0, 5).map(({ id, archiveOrder }) => ({ id, archiveOrder })),
    [
      { id: "loadbalancer", archiveOrder: 10 },
      { id: "scraper", archiveOrder: 11 },
      { id: "website-creation-workflow", archiveOrder: 12 },
      { id: "rafaglot", archiveOrder: 13 },
      { id: "eo-pages", archiveOrder: 20 },
    ],
  );
  assert.equal(
    new Set(projects.map((project) => project.archiveOrder)).size,
    projects.length,
  );
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
