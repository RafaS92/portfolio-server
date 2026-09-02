import { createPortfolioChunks } from "../src/portfolio/chunks.js";
import { loadPortfolio } from "../src/portfolio/content.js";

const portfolio = loadPortfolio();
const chunks = createPortfolioChunks(portfolio);

console.log(
  `Portfolio content is valid: ${portfolio.items.length} items, ${chunks.length} localized chunks.`,
);
