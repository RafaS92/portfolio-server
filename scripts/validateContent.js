import { loadPortfolio } from "../src/content/portfolio.js";
import { createPortfolioChunks } from "../src/rag/chunkPortfolio.js";

const portfolio = loadPortfolio();
const chunks = createPortfolioChunks(portfolio);

console.log(
  `Portfolio content is valid: ${portfolio.items.length} items, ${chunks.length} localized chunks.`,
);
