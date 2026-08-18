import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.js";

const allowedOrigins = [
  "https://www.rafaelsvaldez.com",
  "http://localhost:3000",
];

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: allowedOrigins,
    }),
  );
  app.use(express.json());
  app.use("/api", chatRouter);

  return app;
}
