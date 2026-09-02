import { searchPortfolio } from "../rag/pineconeStore.js";
import { generateGroundedAnswer } from "./conversation.js";

const SUPPORTED_LOCALES = new Set(["en", "es"]);
const SUPPORTED_HISTORY_ROLES = new Set(["user", "assistant"]);
const MAX_MESSAGE_LENGTH = 1_000;
const MAX_HISTORY_MESSAGES = 10;

export class ChatValidationError extends Error {}

function validateMessage(message, fieldName) {
  if (typeof message !== "string" || !message.trim()) {
    throw new ChatValidationError(`${fieldName} must be a non-empty string.`);
  }

  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    throw new ChatValidationError(
      `${fieldName} must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    );
  }

  return message.trim();
}

function validateHistory(history) {
  if (history === undefined) return [];
  if (!Array.isArray(history)) {
    throw new ChatValidationError("history must be an array.");
  }
  if (history.length > MAX_HISTORY_MESSAGES) {
    throw new ChatValidationError(
      `history must contain at most ${MAX_HISTORY_MESSAGES} messages.`,
    );
  }

  return history.map((entry, index) => {
    if (!entry || !SUPPORTED_HISTORY_ROLES.has(entry.role)) {
      throw new ChatValidationError(
        `history[${index}].role must be user or assistant.`,
      );
    }

    return {
      role: entry.role,
      content: validateMessage(entry.content, `history[${index}].content`),
    };
  });
}

export function parseChatRequest(body) {
  const message = validateMessage(body?.message, "message");
  const locale = body?.locale ?? "en";

  if (!SUPPORTED_LOCALES.has(locale)) {
    throw new ChatValidationError('locale must be either "en" or "es".');
  }

  return {
    message,
    locale,
    history: validateHistory(body?.history),
  };
}

function toPublicSource(hit) {
  return {
    id: hit.id,
    score: hit.score,
    title: hit.title,
    contentType: hit.content_type,
    topic: hit.topic,
  };
}

export async function answerPortfolioQuestion(
  request,
  {
    search = searchPortfolio,
    generate = generateGroundedAnswer,
  } = {},
) {
  const hits = await search(request.message, {
    locale: request.locale,
    topK: 3,
  });
  const content = await generate({ ...request, hits });

  return {
    content,
    locale: request.locale,
    sources: hits.map(toPublicSource),
  };
}
