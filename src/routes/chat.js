import { Router } from "express";
import { getOpenAIClient, getSupabaseClient } from "../lib/clients.js";
import { generateConversation } from "../services/conversation.js";
import {
  answerPortfolioQuestion,
  ChatValidationError,
  parseChatRequest,
} from "../services/ragChat.js";

export const chatRouter = Router();

chatRouter.post("/chat", async (req, res) => {
  try {
    const request = parseChatRequest(req.body);
    const result = await answerPortfolioQuestion(request);

    return res.json(result);
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Error in /api/chat:", error);
    return res.status(500).json({ error: "Failed to generate a chat response." });
  }
});

chatRouter.post("/createEmbedding", async (req, res) => {
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
    console.error("Error in /api/createEmbedding:", error);
    return res.status(500).json({ error: "Failed to create embedding." });
  }
});

chatRouter.post("/findNearestMatch", async (req, res) => {
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
    console.error("Error in /api/findNearestMatch:", error);
    return res.status(500).json({ error: "Failed to find nearest match." });
  }
});
