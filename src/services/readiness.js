import { env, requireEnvironmentVariables } from "../config/env.js";
import { withTimeout } from "../lib/async.js";
import { getPineconeClient } from "../lib/clients.js";
import { logger } from "../lib/logger.js";

export function createReadinessCheck({
  environment = env,
  getClient = getPineconeClient,
  appLogger = logger,
  now = Date.now,
  successCacheMs = 30_000,
  failureCacheMs = 5_000,
} = {}) {
  let cached;
  let inFlight;

  async function performCheck() {
    const checkedAt = now();

    try {
      requireEnvironmentVariables(
        ["OPENAI_API_KEY", "PINECONE_API_KEY"],
        environment,
      );
    } catch (error) {
      appLogger.error("readiness_configuration_failed", { error });
      const result = {
        ready: false,
        services: { configuration: "unavailable", pinecone: "not_checked" },
      };
      cached = { result, expiresAt: checkedAt + failureCacheMs };
      return result;
    }

    try {
      await withTimeout(
        () => getClient().describeIndex(environment.PINECONE_INDEX),
        environment.READINESS_TIMEOUT_MS,
        "Pinecone readiness check",
      );
      const result = {
        ready: true,
        services: { configuration: "ready", pinecone: "ready" },
      };
      cached = { result, expiresAt: checkedAt + successCacheMs };
      return result;
    } catch (error) {
      appLogger.error("readiness_pinecone_failed", { error });
      const result = {
        ready: false,
        services: { configuration: "ready", pinecone: "unavailable" },
      };
      cached = { result, expiresAt: checkedAt + failureCacheMs };
      return result;
    }
  }

  return async function checkReadiness() {
    if (cached && now() < cached.expiresAt) return cached.result;
    if (inFlight) return inFlight;

    inFlight = performCheck();
    try {
      return await inFlight;
    } finally {
      inFlight = undefined;
    }
  };
}

export const checkReadiness = createReadinessCheck();
