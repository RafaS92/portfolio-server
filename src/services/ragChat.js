import { searchPortfolio } from "../rag/pineconeStore.js";
import { createPortfolioChunks } from "../rag/chunkPortfolio.js";
import { loadPortfolio } from "../content/portfolio.js";
import { generateGroundedAnswer } from "./conversation.js";

const SUPPORTED_LOCALES = new Set(["en", "es"]);
const SUPPORTED_HISTORY_ROLES = new Set(["user", "assistant"]);
const MAX_MESSAGE_LENGTH = 1_000;
const MAX_HISTORY_MESSAGES = 10;
const PROJECT_DISCOVERY_TOP_K = 100;
const PROJECT_RECOMMENDATION_LIMIT = 4;

const portfolioItems = loadPortfolio().items;
const projectItems = portfolioItems.filter(
  (item) => item.type === "project",
);
const rankedProjectIds = [...projectItems]
  .sort((left, right) => left.archiveOrder - right.archiveOrder)
  .map((item) => item.id);
const PROJECT_DISCOVERY_PATTERN =
  /\b(projects?|portfolio work|work samples?|showcase|built|build|created|recommend(?:ed|ation|ations)?|suggest(?:ed|ion|ions)?|proyectos?|trabajos?|muestras?|construy[oó]|cre[oó]|recomienda|recomendar|sugiere|sugerencias)\b/iu;
const ABOUT_RAFA_QUERIES = new Set(["who is rafa", "quien es rafa"]);
const FUTURE_GOAL_PATTERNS = [
  /\b(?:future|long term|career|professional) (?:goal|goals|plan|plans|direction|aspiration|aspirations|project|projects)\b/u,
  /\b(?:working|work) toward\b/u,
  /\b(?:want|wants|plan|plans|hope|hopes|aim|aims) to (?:become|grow|work|build|learn|achieve)\b/u,
  /\bnext (?:career|professional) step\b/u,
  /\b(?:futuro|futura|futuros|futuras|largo plazo|meta profesional|metas profesionales|objetivo profesional|objetivos profesionales|aspiracion|aspiraciones|planes profesionales|proximo paso profesional)\b/u,
  /\b(?:trabaja|trabajando) para (?:convertirse|llegar a ser|alcanzar)\b/u,
  /\b(?:quiere|planea|espera|aspira a) (?:convertirse|crecer|trabajar|crear|aprender|lograr)\b/u,
];
const GUIDED_TOPIC_QUERIES = new Map([
  ["what are rafa s strongest technical skills", "skill"],
  ["cuales son las principales habilidades tecnicas de rafa", "skill"],
  ["tell me about rafa s professional experience", "experience"],
  ["cuentame sobre la experiencia profesional de rafa", "experience"],
  ["what professional services does rafa offer", "service"],
  ["que servicios profesionales ofrece rafa", "service"],
]);
const contentOrder = new Map(
  portfolioItems.flatMap((item, itemIndex) =>
    item.sections.map((section, sectionIndex) => [
      `${item.id}:${section.id}`,
      itemIndex * 100 + sectionIndex,
    ]),
  ),
);
const localPortfolioHits = createPortfolioChunks().map((chunk) => ({
  id: chunk.id,
  item_id: chunk.itemId,
  section_id: chunk.sectionId,
  content_type: chunk.contentType,
  locale: chunk.locale,
  score: 1,
  title: chunk.title,
  topic: chunk.topic,
  chunk_text: chunk.text,
}));

function normalizeProjectReference(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const projectReferences = projectItems.flatMap((item) =>
  [item.id.replaceAll("-", " "), ...Object.values(item.title)].map(
    normalizeProjectReference,
  ),
);

export class ChatValidationError extends Error {}

const FOLLOW_UP_REFERENCE_PATTERN =
  /\b(it|its|that|this|those|these|he|his|she|her|they|them|their|also|more)\b|\b(eso|esa|ese|esto|este|esta|estos|estas|él|ella|ellos|ellas|su|sus|también|más)\b/iu;

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
    itemId: hit.item_id,
    score: hit.score,
    title: hit.title,
    contentType: hit.content_type,
    sectionId: hit.section_id,
    topic: hit.topic,
  };
}

export function buildRetrievalQuery({ message, history = [] }) {
  if (!FOLLOW_UP_REFERENCE_PATTERN.test(message)) return message;

  const previousUserMessage = [...history]
    .reverse()
    .find((entry) => entry.role === "user")?.content;

  return previousUserMessage
    ? `${previousUserMessage}\nFollow-up: ${message}`
    : message;
}

export function isProjectDiscoveryQuery(message) {
  if (!PROJECT_DISCOVERY_PATTERN.test(message)) return false;

  const normalizedMessage = normalizeProjectReference(message);
  return !projectReferences.some((reference) =>
    normalizedMessage.includes(reference),
  );
}

export function isAboutRafaQuery(message) {
  return ABOUT_RAFA_QUERIES.has(normalizeProjectReference(message));
}

export function isFutureGoalQuery(message) {
  const normalizedMessage = normalizeProjectReference(message);
  return FUTURE_GOAL_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
}

export function getGuidedTopic(message) {
  return GUIDED_TOPIC_QUERIES.get(normalizeProjectReference(message)) ?? null;
}

export function selectGuidedTopicHits(hits, contentType) {
  return hits
    .filter((hit) => hit.content_type === contentType)
    .sort(
      (left, right) =>
        (contentOrder.get(`${left.item_id}:${left.section_id}`) ?? Infinity) -
        (contentOrder.get(`${right.item_id}:${right.section_id}`) ?? Infinity),
    );
}

export function selectFutureGoalHits(hits) {
  return hits.filter(
    (hit) =>
      hit.item_id === "profile-overview" &&
      hit.section_id === "future-career-goal",
  );
}

export function prioritizeProjectHitsByArchiveOrder(
  hits,
  limit = PROJECT_RECOMMENDATION_LIMIT,
) {
  const bestHitByProject = new Map();

  for (const hit of hits) {
    if (hit.content_type !== "project") continue;

    const existingHit = bestHitByProject.get(hit.item_id);
    if (!existingHit || hit.score > existingHit.score) {
      bestHitByProject.set(hit.item_id, hit);
    }
  }

  const rankedHits = rankedProjectIds
    .map((itemId) => bestHitByProject.get(itemId))
    .filter(Boolean);
  const rankedIdSet = new Set(rankedProjectIds);
  const remainingHits = [...bestHitByProject.values()]
    .filter((hit) => !rankedIdSet.has(hit.item_id))
    .sort((left, right) => right.score - left.score);

  return [...rankedHits, ...remainingHits].slice(0, limit);
}

export function prioritizeProjectSourceSlots(hits, candidates = hits) {
  const projectSlotCount = hits.filter(
    (hit) => hit.content_type === "project",
  ).length;
  const rankedProjects = prioritizeProjectHitsByArchiveOrder(
    candidates,
    projectSlotCount,
  );
  let projectIndex = 0;

  return hits.map((hit) =>
    hit.content_type === "project"
      ? (rankedProjects[projectIndex++] ?? hit)
      : hit,
  );
}

export async function answerPortfolioQuestion(
  request,
  {
    search = searchPortfolio,
    generate = generateGroundedAnswer,
    signal,
  } = {},
) {
  const futureGoal = isFutureGoalQuery(request.message);
  const projectDiscovery =
    !futureGoal && isProjectDiscoveryQuery(request.message);
  const aboutRafa = isAboutRafaQuery(request.message);
  const guidedTopic = getGuidedTopic(request.message);
  const retrievedHits = guidedTopic || futureGoal
    ? localPortfolioHits.filter((hit) => hit.locale === request.locale)
    : await search(buildRetrievalQuery(request), {
        locale: request.locale,
        topK:
          projectDiscovery || aboutRafa ? PROJECT_DISCOVERY_TOP_K : 3,
      });
  const hits = projectDiscovery
    ? prioritizeProjectHitsByArchiveOrder(retrievedHits)
    : futureGoal
      ? selectFutureGoalHits(retrievedHits)
    : guidedTopic
      ? selectGuidedTopicHits(retrievedHits, guidedTopic)
      : aboutRafa
        ? retrievedHits.slice(0, 3)
        : retrievedHits;
  const sourceHits = aboutRafa
    ? prioritizeProjectSourceSlots(hits, retrievedHits)
    : hits;
  const content = await generate(
    { ...request, hits, projectDiscovery },
    undefined,
    { signal },
  );

  return {
    content,
    locale: request.locale,
    sources: sourceHits.map(toPublicSource),
  };
}
