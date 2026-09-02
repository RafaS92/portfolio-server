import cors from "cors";
import express from "express";
import { createChatRouter } from "./chat-route.js";
import { createHealthRouter } from "./health-routes.js";
import {
  createRateLimiter,
  createRequestLogger,
  requestId,
} from "./request-middleware.js";

class CorsOriginError extends Error {
  constructor() {
    super("Origin is not allowed.");
    this.name = "CorsOriginError";
  }
}

export function createApp({ config, logger, chatService, readinessCheck }) {
  const app = express();
  const allowedOrigins = new Set(config.CORS_ALLOWED_ORIGINS);

  app.disable("x-powered-by");
  if (config.TRUST_PROXY) app.set("trust proxy", 1);
  app.use(requestId);
  app.use(createRequestLogger(logger));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new CorsOriginError());
      },
    }),
  );
  app.use(express.json({ limit: config.JSON_BODY_LIMIT }));
  app.use(createHealthRouter({ readinessCheck }));
  app.use(
    "/api/chat",
    createRateLimiter({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
    }),
  );
  app.use(
    "/api",
    createChatRouter({ config, logger, chatService }),
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
      logger.error("unhandled_request_error", {
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
