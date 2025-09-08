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
    const chatMessages = [
      {
        role: "system",
        content: `You are Rafa's AI assistant. 
      Your personality is kind, friendly, and a little playful while staying professional. 
      Speak in a warm, conversational tone, as if chatting with a friend. 
      If someone asks "how are you?", respond naturally (e.g., "I’m doing great, thanks for asking! How about you?"). 
      Keep answers concise (2–4 sentences max). 
      If the user wants more details, offer to explain further. 
      Use the provided context as much as possible. 
      If you truly don’t know something, politely say "Sorry, I don’t know the answer."`,
      },
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
