import { createPortfolioChunks } from "../src/portfolio/chunks.js";

const chunks = createPortfolioChunks();

for (const chunk of chunks) {
  console.log(`\n[${chunk.id}]`);
  console.log(
    `${chunk.contentType} | ${chunk.locale} | ${chunk.estimatedTokens} estimated tokens`,
  );
  console.log(chunk.text);
}

console.log(`\nTotal chunks: ${chunks.length}`);
