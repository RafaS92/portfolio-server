import { Router } from "express";
import { env } from "../config/env.js";
import { OperationTimeoutError, withTimeout } from "../lib/async.js";
import { logger } from "../lib/logger.js";
import {
  answerPortfolioQuestion,
  ChatValidationError,
  parseChatRequest,
} from "../services/ragChat.js";

function safeError(res, status, message, requestId) {
  return res.status(status).json({ error: message, requestId });
}

export function createChatRouter({
  environment = env,
  answer = answerPortfolioQuestion,
  appLogger = logger,
} = {}) {
  const router = Router();

  router.post("/chat", async (req, res) => {
    try {
      const request = parseChatRequest(req.body);
      const result = await withTimeout(
        (signal) => answer(request, { signal }),
        environment.CHAT_REQUEST_TIMEOUT_MS,
        "Chat request",
      );

      return res.json(result);
    } catch (error) {
      if (error instanceof ChatValidationError) {
        return safeError(res, 400, error.message, req.requestId);
      }
      if (error instanceof OperationTimeoutError) {
        appLogger.error("chat_timeout", { requestId: req.requestId, error });
        return safeError(
          res,
          504,
          "RafaBot took too long to respond. Please try again.",
          req.requestId,
        );
      }

      appLogger.error("chat_failed", { requestId: req.requestId, error });
      return safeError(
        res,
        500,
        "Failed to generate a chat response.",
        req.requestId,
      );
    }
  });

  return router;
}

export const chatRouter = createChatRouter();
