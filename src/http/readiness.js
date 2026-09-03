import { requireEnvironmentVariables } from "../platform/config.js";
import { withTimeout } from "../platform/timeout.js";

export function createReadinessCheck({
  config,
  pineconeClient,
  logger,
  clock = Date.now,
  successCacheMs = 30_000,
  failureCacheMs = 5_000,
}) {
  let cached;
  let inFlight;

  async function performCheck() {
    const checkedAt = clock();

    try {
      requireEnvironmentVariables(
        ["OPENAI_API_KEY", "PINECONE_API_KEY"],
        config,
      );
    } catch (error) {
      logger.error("readiness_configuration_failed", { error });
      const result = {
        ready: false,
        services: { configuration: "unavailable", pinecone: "not_checked" },
      };
      cached = { result, expiresAt: checkedAt + failureCacheMs };
      return result;
    }

    try {
      await withTimeout(
        () => pineconeClient.describeIndex(config.PINECONE_INDEX),
        config.READINESS_TIMEOUT_MS,
        "Pinecone readiness check",
      );
      const result = {
        ready: true,
        services: { configuration: "ready", pinecone: "ready" },
      };
      cached = { result, expiresAt: checkedAt + successCacheMs };
      return result;
    } catch (error) {
      logger.error("readiness_pinecone_failed", { error });
      const result = {
        ready: false,
        services: { configuration: "ready", pinecone: "unavailable" },
      };
      cached = { result, expiresAt: checkedAt + failureCacheMs };
      return result;
    }
  }

  return async function checkReadiness() {
    if (cached && clock() < cached.expiresAt) return cached.result;
    if (inFlight) return inFlight;

    inFlight = performCheck();
    try {
      return await inFlight;
    } finally {
      inFlight = undefined;
    }
  };
}
