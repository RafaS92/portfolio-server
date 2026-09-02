import { createApp } from "./src/app.js";
import { env, requireEnvironmentVariables } from "./src/config/env.js";
import { logger } from "./src/lib/logger.js";
import { createGracefulShutdown } from "./src/serverLifecycle.js";

requireEnvironmentVariables([
  "OPENAI_API_KEY",
  "PINECONE_API_KEY",
]);

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info("server_started", {
    host: env.HOST,
    port: env.PORT,
    environment: env.NODE_ENV,
    pineconeIndex: env.PINECONE_INDEX,
    pineconeNamespace: env.PINECONE_NAMESPACE,
  });
});

const shutdown = createGracefulShutdown(server, {
  timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
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
