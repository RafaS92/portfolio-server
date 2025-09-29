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

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    return allowedOrigins.includes(origin)
      ? cb(null, true)
      : cb(new Error("CORS: Origin not allowed"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("/*", cors(corsOptions));

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
  process.env.SUPABASE_API_KEY
);

async function generateConversation(match, message) {
  try {
    const chatMessages = [
      {
        role: "system",
        content: `
          You are "Welcoming Bot", a concise concierge for rafaelsvaldez.com.

          GOALS
          - Greet briefly (only if the visitor hasn't asked a direct question), and ask for the visitor's name once.
          - Answer using ONLY the provided Context. If info is missing, reply: "Sorry, I don’t know. Please ask Rafa directly."
          - Keep responses brief and friendly (2–5 sentences) and optionally add a helpful follow-up.

          STYLE
          - Warm, human, positive.
          - Respond in the same language as the Visitor Message (Spanish if they wrote in Spanish; otherwise English).
          - Use short paragraphs or bullets.

          RULES
          - Never invent details outside Context.
          - No sensitive advice, secrets, or backend info.
          - For deep technical help, direct to Rafa.
          - If Context is empty or irrelevant, ask a single clarifying question (e.g., experience, projects, stack).
        `.trim(),
      },
      {
        role: "user",
        content: `Tell me about Rafa`,
      },
      {
        role: "assistant",
        content:
          `Rafa is a Houston-based full-stack engineer who builds web and mobile apps end-to-end. ` +
          `He works with React, Angular, TypeScript, Node.js, and AWS. He started coding in 2019, ` +
          `studied at Flatiron School, and has experience at Sourcemap (2023–2025) and Energy Ogre (2021–2023).`,
      },
      {
        role: "user",
        content: `My name is John.`,
      },
      {
        role: "assistant",
        content: `Hi John! How can I help you?`,
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
