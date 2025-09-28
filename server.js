import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Railway provides environment variables automatically; no dotenv needed
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY is missing!");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const privateKey = process.env.SUPABASE_API_KEY;
const url = process.env.SUPABASE_URL;
const supabase = createClient(url, privateKey);

async function generateConversation(match, message) {
  try {
    const context = (match ?? "").trim();
    const visitorMsg = (message ?? "").trim();

    const chatMessages = [
      {
        role: "system",
        content: ```
        You are "Welcoming Bot", a concise concierge for rafaelsvaldez.com.

        GOALS
        - Greet briefly (only if the visitor hasn't asked a direct question), and ask for the visitor's name once.
        - Answer using ONLY the provided Context. If info is missing, reply: "Sorry, I don’t know. Please ask Rafa directly."
        - Keep responses brief and friendly; optionally add a helpful follow-up.

        STYLE
        - Warm, human, positive.
        - Respond in the same language as the Visitor Message (Spanish if they wrote in Spanish; otherwise English).
        - Use short paragraphs or bullets.

        RULES
        - Never invent details outside Context.
        - No sensitive advice, secrets, or backend info.
        - For deep technical help, direct to Rafa.
        - If Context is empty or irrelevant, ask a single clarifying question (e.g., experience, projects, stack).
        ```,
      },
      // ==== ONE-SHOT EXAMPLE (kept consistent with "Context-only") ====
      // This example assumes Context actually contains Rafa's bio.
      {
        role: "user",
        content: `Tell me about Rafa`,
      },
      {
        role: "assistant",
        content: `Rafa is a Houston-based full-stack engineer who builds web and mobile apps end-to-end. He works with React, Angular, TypeScript, Node.js, and AWS. He started coding in 2019, studied at Flatiron School, and has experience at Sourcemap (2023–2025) and Energy Ogre (2021–2023).`,
      },
      // ==== END EXAMPLE ====
    ];

    chatMessages.push({
      role: "user",
      content: `Context: ${match} Question: ${message}`,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: chatMessages,
      temperature: 0.5,
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.3,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error in generateConversation:", error);
    return "Sorry, something went wrong while generating the conversation.";
  }
}

app.post("/api/createEmbedding", async (req, res) => {
  try {
    const { messagge } = req.body;

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: messagge,
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

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
