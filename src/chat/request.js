import { SUPPORTED_LOCALES } from "../portfolio/content.js";

const SUPPORTED_HISTORY_ROLES = new Set(["user", "assistant"]);
const MAX_MESSAGE_LENGTH = 1_000;
export const MAX_HISTORY_MESSAGES = 10;

/**
 * @typedef {Object} ChatMessage
 * @property {"user" | "assistant"} role
 * @property {string} content
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} message
 * @property {"en" | "es"} locale
 * @property {ChatMessage[]} history
 */

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

/** @returns {ChatRequest} */
export function parseChatRequest(body) {
  const message = validateMessage(body?.message, "message");
  const locale = body?.locale ?? "en";

  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new ChatValidationError('locale must be either "en" or "es".');
  }

  return {
    message,
    locale,
    history: validateHistory(body?.history),
  };
}
