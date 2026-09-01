import assert from "node:assert/strict";
import { test } from "node:test";

process.env.OPENAI_API_KEY ??= "test-openai-key";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_API_KEY ??= "test-supabase-key";

const { searchPortfolio, syncPortfolioChunks } = await import(
  "../src/rag/pineconeStore.js"
);

function createClient(namespace) {
  return {
    async describeIndex() {
      return { status: { ready: true } };
    },
    index() {
      return {
        namespace() {
          return namespace;
        },
      };
    },
  };
}

test("sync upserts current records and deletes stale IDs", async () => {
  const calls = { deleted: [], upserted: [] };
  const namespace = {
    async listPaginated() {
      return {
        vectors: [{ id: "current-en" }, { id: "removed-en" }],
      };
    },
    async deleteMany({ ids }) {
      calls.deleted.push(...ids);
    },
    async upsertRecords({ records }) {
      calls.upserted.push(...records);
    },
  };
  const chunks = [
    {
      id: "current-en",
      itemId: "current",
      sectionId: "summary",
      contentType: "project",
      locale: "en",
      title: "Current",
      organization: null,
      role: null,
      topic: "summary",
      startDate: null,
      endDate: null,
      technologies: ["Node.js"],
      tags: ["rag"],
      text: "Current project summary.",
    },
  ];

  const result = await syncPortfolioChunks({
    client: createClient(namespace),
    chunks,
  });

  assert.deepEqual(calls.deleted, ["removed-en"]);
  assert.equal(calls.upserted.length, 1);
  assert.equal(calls.upserted[0]._id, "current-en");
  assert.equal(result.upserted, 1);
  assert.equal(result.deleted, 1);
});

test("search embeds text inside Pinecone and applies the language filter", async () => {
  let searchOptions;
  const namespace = {
    async searchRecords(options) {
      searchOptions = options;
      return {
        result: {
          hits: [
            {
              _id: "rafa-summary-es",
              _score: 0.91,
              fields: {
                chunk_text: "Resumen de Rafa.",
                locale: "es",
              },
            },
          ],
        },
      };
    },
  };

  const results = await searchPortfolio("¿Quién es Rafa?", {
    locale: "es",
    topK: 3,
    client: createClient(namespace),
  });

  assert.deepEqual(searchOptions.query.inputs, { text: "¿Quién es Rafa?" });
  assert.deepEqual(searchOptions.query.filter, { locale: { $eq: "es" } });
  assert.equal(results[0].id, "rafa-summary-es");
  assert.equal(results[0].score, 0.91);
});
