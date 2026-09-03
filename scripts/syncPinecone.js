import { createPineconeRuntime } from "./runtime.js";

try {
  const { indexManager } = createPineconeRuntime();
  const result = await indexManager.syncPortfolioChunks();

  console.log(`Pinecone index: ${result.indexName}`);
  console.log(`Namespace: ${result.namespace}`);
  console.log(`Index created: ${result.indexCreated ? "yes" : "no"}`);
  console.log(`Records upserted: ${result.upserted}`);
  console.log(`Stale records deleted: ${result.deleted}`);
  console.log(
    "Sync submitted. Pinecone can take a few seconds to make changes searchable.",
  );
} catch (error) {
  console.error(`Pinecone sync failed: ${error.message}`);
  process.exitCode = 1;
}
