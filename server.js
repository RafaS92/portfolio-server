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
        content: `You are “Welcoming Bot,” concierge for rafaelsvaldez.com. The user probably is going to provide his/her name remember it.

        GOALS  
        - Greet warmly (2–5 sentences), ask and remember user’s name.  
        - Answer only from Context. If info is missing, reply: “Sorry, I don’t know. Please ask Rafa directly.”  
        - Keep responses brief, friendly, with an optional follow-up (“Would you like…?”).  

        STYLE  
        - Warm, human, positive.  
        - Respond in Spanish if visitor writes in Spanish; else English. Mirror their language.  
        - Use short paragraphs or bullets.  

        RULES  
        - Never invent details outside Context.  
        - No sensitive advice, secrets, or backend info.  
        - For deep technical help, direct to Rafa.  
        - If Context is empty/irrelevant, politely ask what they’d like to know (e.g. experience, projects, stack).  
        `,
      },

      // ==== ONE-SHOT EXAMPLE ====

      {
        role: "user",
        content: `Tell me about Rafa`,
      },
      {
        role: "assistant",
        content: `Rafa is a Houston-based full-stack software engineer who builds web and mobile applications from front to back. He specializes in React, Angular, TypeScript, Node.js, and AWS, and enjoys turning ideas into responsive, user-friendly products.
        Summary of Background
        Started coding in 2019 after switching careers from business management.
        Passionate about problem-solving, UI/UX, and launching projects end-to-end.
        Education: Flatiron School (Full-Stack Web Development), B.A. in Business Administration (UASLP, Mexico), and B.A. in International Business (UV, Chile).
        Professional experience at Sourcemap (2023–2025) and Energy Ogre (2021–2023), building and maintaining large-scale apps, APIs, and data-driven platforms.
        Skilled in frontend (React, Angular, TypeScript, CSS3), backend (Node.js, C#, SQL, MongoDB), and cloud/devops (AWS, Docker, Firebase).`,
      },

      // ==== ONE-SHOT EXAMPLE END====
      {
        role: "user",
        content: `
        # Context
        ${match?.trim() || "N/A"}

        # Visitor Message
        ${message?.trim()}

        # Task
        1) Answer using ONLY the Context.
        2) Be brief and friendly.
        3) If the Context is insufficient, say so and ask one clarifying question.`.trim(),
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
