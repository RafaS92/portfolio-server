import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { createRateLimiter, requestId } from "./middleware/requestProtection.js";
import { createChatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";

class CorsOriginError extends Error {
  constructor() {
    super("Origin is not allowed.");
    this.name = "CorsOriginError";
  }
}

export function createApp({ environment = env, chatAnswer } = {}) {
  const app = express();
  const allowedOrigins = new Set(environment.CORS_ALLOWED_ORIGINS);

  app.disable("x-powered-by");
  if (environment.TRUST_PROXY) app.set("trust proxy", 1);
  app.use(requestId);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new CorsOriginError());
      },
    }),
  );
  app.use(express.json({ limit: environment.JSON_BODY_LIMIT }));
  app.use(healthRouter);
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
      console.error("Unhandled request error.", {
        requestId: req.requestId,
        errorName: error?.name ?? "Error",
      });
    }
    return res.status(status).json({
      error: message,
      requestId: req.requestId,
    });
  });

  return app;
}
