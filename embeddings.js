import { openai, supabase } from "./src/lib/clients.js";
import { createPortfolioChunks } from "./src/rag/chunkPortfolio.js";

// Legacy Supabase ingestion helper. It is intentionally not executed
// automatically. A later learning step will replace this with Pinecone.
export async function createAndStoreEmbeddings() {
  const chunks = createPortfolioChunks();

  const rows = await Promise.all(
    chunks.map(async (chunk) => {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk.text,
      });

      return {
        content: chunk.text,
        embedding: embeddingResponse.data[0].embedding,
      };
    }),
  );

  const { error } = await supabase.from("rafainfo").insert(rows);

  if (error) throw error;

  console.log(`Stored ${rows.length} portfolio chunks in Supabase.`);
}
