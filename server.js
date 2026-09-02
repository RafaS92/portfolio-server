import { createApp } from "./src/app.js";
import { env, requireEnvironmentVariables } from "./src/config/env.js";
import { createGracefulShutdown } from "./src/serverLifecycle.js";

requireEnvironmentVariables([
  "OPENAI_API_KEY",
  "PINECONE_API_KEY",
]);

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`✅ Server running on port ${env.PORT}`);
});

const shutdown = createGracefulShutdown(server, {
  timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  onComplete(error) {
    if (error) {
      console.error("Server shutdown failed.", { errorName: error.name });
      process.exitCode = 1;
    }
  },
  onForced() {
    console.error("Server shutdown exceeded its configured timeout.");
    process.exitCode = 1;
  },
});

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
