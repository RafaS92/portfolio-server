import { Router } from "express";
import { ChatValidationError, parseChatRequest } from "../chat/request.js";
import {
  OperationTimeoutError,
  withTimeout,
} from "../platform/timeout.js";

function safeError(res, status, message, requestId) {
  return res.status(status).json({ error: message, requestId });
}

export function createChatRouter({ config, logger, chatService }) {
  const router = Router();

  router.post("/chat", async (req, res) => {
    try {
      const request = parseChatRequest(req.body);
      const result = await withTimeout(
        (signal) => chatService(request, { signal }),
        config.CHAT_REQUEST_TIMEOUT_MS,
        "Chat request",
      );

      return res.json(result);
    } catch (error) {
      if (error instanceof ChatValidationError) {
        return safeError(res, 400, error.message, req.requestId);
      }
      if (error instanceof OperationTimeoutError) {
        logger.error("chat_timeout", { requestId: req.requestId, error });
        return safeError(
          res,
          504,
          "RafaBot took too long to respond. Please try again.",
          req.requestId,
        );
      }

      logger.error("chat_failed", { requestId: req.requestId, error });
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
