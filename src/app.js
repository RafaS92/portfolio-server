import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import {
  createRateLimiter,
  createRequestLogger,
  requestId,
} from "./middleware/requestProtection.js";
import { createChatRouter } from "./routes/chat.js";
import { createHealthRouter } from "./routes/health.js";
import { checkReadiness } from "./services/readiness.js";

class CorsOriginError extends Error {
  constructor() {
    super("Origin is not allowed.");
    this.name = "CorsOriginError";
  }
}

export function createApp({
  environment = env,
  chatAnswer,
  appLogger = logger,
  readinessCheck = checkReadiness,
} = {}) {
  const app = express();
  const allowedOrigins = new Set(environment.CORS_ALLOWED_ORIGINS);

  app.disable("x-powered-by");
  if (environment.TRUST_PROXY) app.set("trust proxy", 1);
  app.use(requestId);
  app.use(createRequestLogger(appLogger));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new CorsOriginError());
      },
    }),
  );
  app.use(express.json({ limit: environment.JSON_BODY_LIMIT }));
  app.use(createHealthRouter({ checkReadiness: readinessCheck }));
  app.use(
    "/api/chat",
    createRateLimiter({
      windowMs: environment.RATE_LIMIT_WINDOW_MS,
      maxRequests: environment.RATE_LIMIT_MAX_REQUESTS,
    }),
  );
  app.use(
    "/api",
    createChatRouter({
      environment,
      appLogger,
      ...(chatAnswer ? { answer: chatAnswer } : {}),
    }),
  );

  app.use((req, res) =>
    res.status(404).json({ error: "Route not found.", requestId: req.requestId }),
  );

  app.use((error, req, res, _next) => {
    const bodyTooLarge = error?.type === "entity.too.large";
    const invalidJson = error instanceof SyntaxError && "body" in error;
    const corsRejected = error instanceof CorsOriginError;
    const status = bodyTooLarge ? 413 : invalidJson ? 400 : corsRejected ? 403 : 500;
    const message = bodyTooLarge
      ? "Request body is too large."
      : invalidJson
        ? "Request body contains invalid JSON."
        : corsRejected
          ? "Origin is not allowed."
          : "Internal server error.";

    if (status === 500) {
      appLogger.error("unhandled_request_error", {
        requestId: req.requestId,
        error,
      });
    }
    return res.status(status).json({
      error: message,
      requestId: req.requestId,
    });
  });

  return app;
}
