import { createAnswerGenerator } from "../src/chat/answer-generator.js";
import { createRetrievalPolicy } from "../src/chat/retrieval-policy.js";
import { createChatService } from "../src/chat/service.js";
import {
  createOpenAIClient,
  createPineconeClient,
} from "../src/platform/clients.js";
import {
  loadEnvironment,
  requireEnvironmentVariables,
} from "../src/platform/config.js";
import { createPortfolioChunks } from "../src/portfolio/chunks.js";
import { loadPortfolio } from "../src/portfolio/content.js";
import { createPineconeIndexManager } from "../src/portfolio/pinecone-index.js";
import { createPineconeSearch } from "../src/portfolio/pinecone-search.js";

export function createPineconeRuntime() {
  const config = loadEnvironment();
  requireEnvironmentVariables(["PINECONE_API_KEY"], config);

  const pineconeClient = createPineconeClient(config.PINECONE_API_KEY);
  const searchPortfolio = createPineconeSearch({
    pineconeClient,
    indexName: config.PINECONE_INDEX,
    namespace: config.PINECONE_NAMESPACE,
  });
  const indexManager = createPineconeIndexManager({
    pineconeClient,
    indexName: config.PINECONE_INDEX,
    namespace: config.PINECONE_NAMESPACE,
  });

  return { config, indexManager, pineconeClient, searchPortfolio };
}

export function createChatRuntime() {
  const pineconeRuntime = createPineconeRuntime();
  const { config, searchPortfolio } = pineconeRuntime;
  requireEnvironmentVariables(["OPENAI_API_KEY"], config);

  const openAIClient = createOpenAIClient(config.OPENAI_API_KEY);
  const portfolio = loadPortfolio();
  const chunks = createPortfolioChunks(portfolio);
  const retrievalPolicy = createRetrievalPolicy({ portfolio, chunks });
  const generateAnswer = createAnswerGenerator({
    openAIClient,
    model: config.OPENAI_MODEL,
  });
  const chatService = createChatService({
    retrievalPolicy,
    searchPortfolio,
    generateAnswer,
  });

  return {
    ...pineconeRuntime,
    chatService,
    generateAnswer,
    openAIClient,
    retrievalPolicy,
  };
}
