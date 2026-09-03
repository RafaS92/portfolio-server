import { createAnswerGenerator } from "./src/chat/answer-generator.js";
import { createRetrievalPolicy } from "./src/chat/retrieval-policy.js";
import { createChatService } from "./src/chat/service.js";
import { createApp } from "./src/http/app.js";
import { createReadinessCheck } from "./src/http/readiness.js";
import {
  createOpenAIClient,
  createPineconeClient,
} from "./src/platform/clients.js";
import {
  loadEnvironment,
  requireEnvironmentVariables,
} from "./src/platform/config.js";
import {
  createLogger,
  formatStartupBanner,
} from "./src/platform/logger.js";
import { createGracefulShutdown } from "./src/platform/server-lifecycle.js";
import { createPortfolioChunks } from "./src/portfolio/chunks.js";
import { loadPortfolio } from "./src/portfolio/content.js";
import { createPineconeSearch } from "./src/portfolio/pinecone-search.js";

const config = loadEnvironment();
requireEnvironmentVariables([
  "OPENAI_API_KEY",
  "PINECONE_API_KEY",
], config);

const logger = createLogger({
  secrets: [config.OPENAI_API_KEY, config.PINECONE_API_KEY],
});
const openAIClient = createOpenAIClient(config.OPENAI_API_KEY);
const pineconeClient = createPineconeClient(config.PINECONE_API_KEY);
const portfolio = loadPortfolio();
const chunks = createPortfolioChunks(portfolio);
const retrievalPolicy = createRetrievalPolicy({ portfolio, chunks });
const searchPortfolio = createPineconeSearch({
  pineconeClient,
  indexName: config.PINECONE_INDEX,
  namespace: config.PINECONE_NAMESPACE,
});
const generateAnswer = createAnswerGenerator({
  openAIClient,
  model: config.OPENAI_MODEL,
});
const chatService = createChatService({
  retrievalPolicy,
  searchPortfolio,
  generateAnswer,
});
const readinessCheck = createReadinessCheck({
  config,
  pineconeClient,
  logger,
});
const app = createApp({ config, logger, chatService, readinessCheck });

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info("server_started", {
    host: config.HOST,
    port: config.PORT,
    environment: config.NODE_ENV,
    pineconeIndex: config.PINECONE_INDEX,
    pineconeNamespace: config.PINECONE_NAMESPACE,
  });
  if (process.stdout.isTTY) {
    console.log(formatStartupBanner({
      host: config.HOST,
      port: config.PORT,
      environment: config.NODE_ENV,
    }));
  }
});

const shutdown = createGracefulShutdown(server, {
  timeoutMs: config.SHUTDOWN_TIMEOUT_MS,
  onComplete(error) {
    if (error) {
      logger.error("server_shutdown_failed", { error });
      process.exitCode = 1;
      return;
    }
    logger.info("server_shutdown_complete");
  },
  onForced() {
    logger.error("server_shutdown_forced");
    process.exitCode = 1;
  },
});

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
