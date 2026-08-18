import { openai } from "../lib/clients.js";

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
      - Keep answers short (2–5 sentences) and friendly. Add an optional follow-up.

      STYLE
      - Warm, human, positive.
      - Reply to visitors mainly in English. If users start to talk explicitly in Spanish, respond in Spanish.
      - Use short paragraphs or bullets with blank lines between ideas.

      RULES
      - If the user says "My name is X", remember it for the rest of the conversation.
      - When asked "What is my name?", respond with the stored name.
      - Never invent info outside Context.
      - No sensitive advice or backend details.
      - For deep technical help, direct to Rafa.
      - If Context is empty/irrelevant, ask one clarifying question.
    `.trim(),
  },
];

export async function generateConversation(match, message) {
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
