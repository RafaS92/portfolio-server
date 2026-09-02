import { Router } from "express";
import { env } from "../config/env.js";
import { OperationTimeoutError, withTimeout } from "../lib/async.js";
import { getOpenAIClient, getSupabaseClient } from "../lib/clients.js";
import { generateConversation } from "../services/conversation.js";
import {
  answerPortfolioQuestion,
  ChatValidationError,
  parseChatRequest,
} from "../services/ragChat.js";

function safeError(res, status, message, requestId) {
  return res.status(status).json({ error: message, requestId });
}

function logFailure(event, requestId, error) {
  console.error(event, {
    requestId,
    errorName: error?.name ?? "Error",
  });
}

export function createChatRouter({
  environment = env,
  answer = answerPortfolioQuestion,
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
        logFailure("Chat request timed out.", req.requestId, error);
        return safeError(
          res,
          504,
          "RafaBot took too long to respond. Please try again.",
          req.requestId,
        );
      }

      logFailure("Chat request failed.", req.requestId, error);
      return safeError(
        res,
        500,
        "Failed to generate a chat response.",
        req.requestId,
      );
    }
  });

  router.post("/createEmbedding", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'message'." });
      }

      const embeddingResponse = await getOpenAIClient().embeddings.create({
        model: "text-embedding-ada-002",
        input: message,
      });

      return res.json({ embedding: embeddingResponse.data[0].embedding });
    } catch (error) {
      logFailure("Legacy embedding request failed.", req.requestId, error);
      return safeError(
        res,
        500,
        "Failed to create embedding.",
        req.requestId,
      );
    }
  });

  router.post("/findNearestMatch", async (req, res) => {
    try {
      const { embedding, message } = req.body;

      const { data } = await getSupabaseClient().rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 1,
      });

      const match = data[0].content;
      const result = await generateConversation(match, message);

      return res.json({ content: result });
    } catch (error) {
      logFailure("Legacy nearest-match request failed.", req.requestId, error);
      return safeError(
        res,
        500,
        "Failed to find nearest match.",
        req.requestId,
      );
    }
  });

  return router;
}

export const chatRouter = createChatRouter();
