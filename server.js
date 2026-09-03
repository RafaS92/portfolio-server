import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  "https://www.rafaelsvaldez.com",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: allowedOrigins,
  }),
);

app.use(express.json());

if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY is missing!");
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_API_KEY) {
  console.error("⚠️ SUPABASE_URL or SUPABASE_API_KEY is missing!");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
);

const chatMessages = [
  {
    role: "system",
    content: `
      You are "Welcoming Bot" and your name is RafaBot, a guide for users navigating Rafa's portfolio. In the UI you are already introduced as "Rafa Bot". Ask the user's name.

      GOALS
      - Greet warmly only once at the beginning of a new conversation.
      - Do NOT greet again in later responses.
      - This is the first time you are talking with the user.
      - If the user does not provide a name, call them "friend".
      - Answer strictly from the provided Context. If missing, say: "Sorry, I don’t know. Please ask Rafa directly."
      - Keep answers short (2–5 sentences) and friendly. You may add one optional follow-up, but it must be about Rafa or Rafa's portfolio.

      STYLE
      - Warm, human, positive.
      - Reply to visitors mainly in English. If users start to talk explicitly in Spanish, respond in Spanish.
      - Use short paragraphs or bullets with blank lines between ideas.

      RULES
      - If the user says "My name is X", remember it for the rest of the conversation.
      - When asked "What is my name?", respond with the stored name.
      - Never invent info outside Context.
      - Keep every follow-up focused on Rafa. Never ask the visitor about their own preferences, experiences, background, or personal life.
      - Good follow-ups include "Would you like to know more about Rafa's favorite foods?" and "Would you like to hear about another project Rafa worked on?"
      - Do not ask questions such as "What about you?", "What is your favorite food?", or their equivalents in another language.
      - No sensitive advice or backend details.
      - For deep technical help, direct to Rafa.
      - If Context is empty/irrelevant, ask one clarifying question.
    `.trim(),
  },
];

async function generateConversation(match, message) {
  try {
    chatMessages.push({
      role: "user",
      content: `Context: ${match} Question: ${message}`,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages,
      temperature: 0.2,
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.3,
    });

    const reply = response.choices[0].message.content;

    chatMessages.push({
      role: "assistant",
      content: reply,
    });

    return reply;
  } catch (error) {
    console.error("Error in generateConversation:", error);
    return "Sorry, something went wrong while generating the conversation.";
  }
}

app.post("/api/createEmbedding", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'message'." });
    }

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: message,
    });

    res.json({ embedding: embeddingResponse.data[0].embedding });
  } catch (error) {
    console.error("Error in /api/createEmbedding:", error);
    res.status(500).json({ error: "Failed to create embedding." });
  }
});

app.post("/api/findNearestMatch", async (req, res) => {
  try {
    const { embedding, message } = req.body;

    const { data } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 1,
    });

    const match = data[0].content;

    const result = await generateConversation(match, message);

    res.json({ content: result });
  } catch (error) {
    console.error("Error in /api/findNearestMatch:", error);
    res.status(500).json({ error: "Failed to find nearest match." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
