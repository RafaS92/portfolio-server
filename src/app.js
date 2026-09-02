import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { chatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
    }),
  );
  app.use(express.json());
  app.use(healthRouter);
  app.use("/api", chatRouter);

  return app;
}
