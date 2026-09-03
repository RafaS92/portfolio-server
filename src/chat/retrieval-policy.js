const PROJECT_DISCOVERY_TOP_K = 100;
const PROJECT_RECOMMENDATION_LIMIT = 4;
const PROJECT_DISCOVERY_PATTERN =
  /\b(projects?|portfolio work|work samples?|showcase|built|build|created|recommend(?:ed|ation|ations)?|suggest(?:ed|ion|ions)?|proyectos?|trabajos?|muestras?|construy[oó]|cre[oó]|recomienda|recomendar|sugiere|sugerencias)\b/iu;
const ABOUT_RAFA_QUERIES = new Set([
  "who is rafa",
  "tell me about rafa",
  "describe rafa",
  "quien es rafa",
  "cuentame sobre rafa",
  "hablame de rafa",
  "describe a rafa",
]);
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
const FOLLOW_UP_REFERENCE_PATTERN =
  /\b(it|its|that|this|those|these|he|his|she|her|they|them|their|also|more)\b|\b(eso|esa|ese|esto|este|esta|estos|estas|él|ella|ellos|ellas|su|sus|también|más)\b/iu;
const EXPLICIT_RAFA_PATTERN = /\bRafa(?:el)?\b/iu;

function normalizeReference(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toLocalHit(chunk) {
  return {
    id: chunk.id,
    item_id: chunk.itemId,
    section_id: chunk.sectionId,
    content_type: chunk.contentType,
    locale: chunk.locale,
    score: 1,
    title: chunk.title,
    topic: chunk.topic,
    chunk_text: chunk.text,
  };
}

export function buildRetrievalQuery({ message, locale = "en", history = [] }) {
  const previousUserMessage = [...history]
    .reverse()
    .find((entry) => entry.role === "user")?.content;

  if (FOLLOW_UP_REFERENCE_PATTERN.test(message) && previousUserMessage) {
    const followUpLabel = locale === "es"
      ? "Seguimiento sobre Rafa"
      : "Follow-up about Rafa";
    return `${previousUserMessage}\n${followUpLabel}: ${message}`;
  }

  if (EXPLICIT_RAFA_PATTERN.test(message)) return message;

  const subjectLabel = locale === "es"
    ? "Sobre Rafa y su portafolio"
    : "About Rafa and his portfolio";
  return `${subjectLabel}: ${message}`;
}

export function createRetrievalPolicy({ portfolio, chunks }) {
  const projectItems = portfolio.items.filter((item) => item.type === "project");
  const rankedProjectIds = [...projectItems]
    .sort((left, right) => left.archiveOrder - right.archiveOrder)
    .map((item) => item.id);
  const projectReferences = projectItems.flatMap((item) =>
    [item.id.replaceAll("-", " "), ...Object.values(item.title)].map(
      normalizeReference,
    ),
  );
  const contentOrder = new Map(
    portfolio.items.flatMap((item, itemIndex) =>
      item.sections.map((section, sectionIndex) => [
        `${item.id}:${section.id}`,
        itemIndex * 100 + sectionIndex,
      ]),
    ),
  );
  const localPortfolioHits = chunks.map(toLocalHit);

  function isProjectDiscoveryQuery(message) {
    if (!PROJECT_DISCOVERY_PATTERN.test(message)) return false;

    const normalizedMessage = normalizeReference(message);
    return !projectReferences.some((reference) =>
      normalizedMessage.includes(reference),
    );
  }

  function isAboutRafaQuery(message) {
    return ABOUT_RAFA_QUERIES.has(normalizeReference(message));
  }

  function isFutureGoalQuery(message) {
    const normalizedMessage = normalizeReference(message);
    return FUTURE_GOAL_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
  }

  function getGuidedTopic(message) {
    return GUIDED_TOPIC_QUERIES.get(normalizeReference(message)) ?? null;
  }

  function selectGuidedTopicHits(hits, contentType) {
    return hits
      .filter((hit) => hit.content_type === contentType)
      .sort(
        (left, right) =>
          (contentOrder.get(`${left.item_id}:${left.section_id}`) ?? Infinity) -
          (contentOrder.get(`${right.item_id}:${right.section_id}`) ?? Infinity),
      );
  }

  function selectFutureGoalHits(hits) {
    return hits.filter(
      (hit) =>
        hit.item_id === "profile-overview" &&
        hit.section_id === "future-career-goal",
    );
  }

  function prioritizeProjectHitsByArchiveOrder(
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

  function prioritizeProjectSourceSlots(hits, candidates = hits) {
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

  function plan(request) {
    const futureGoal = isFutureGoalQuery(request.message);
    const projectDiscovery =
      !futureGoal && isProjectDiscoveryQuery(request.message);
    const aboutRafa = isAboutRafaQuery(request.message);
    const guidedTopic = getGuidedTopic(request.message);
    const useLocalPortfolio = Boolean(guidedTopic || futureGoal);

    return {
      aboutRafa,
      futureGoal,
      guidedTopic,
      projectDiscovery,
      query: buildRetrievalQuery(request),
      topK: projectDiscovery || aboutRafa ? PROJECT_DISCOVERY_TOP_K : 3,
      localHits: useLocalPortfolio
        ? localPortfolioHits.filter((hit) => hit.locale === request.locale)
        : null,
    };
  }

  function selectGenerationHits(retrievalPlan, retrievedHits) {
    if (retrievalPlan.projectDiscovery) {
      return prioritizeProjectHitsByArchiveOrder(retrievedHits);
    }
    if (retrievalPlan.futureGoal) {
      return selectFutureGoalHits(retrievedHits);
    }
    if (retrievalPlan.guidedTopic) {
      return selectGuidedTopicHits(retrievedHits, retrievalPlan.guidedTopic);
    }
    if (retrievalPlan.aboutRafa) return retrievedHits.slice(0, 3);
    return retrievedHits;
  }

  function selectSourceHits(retrievalPlan, hits, candidates) {
    return retrievalPlan.aboutRafa
      ? prioritizeProjectSourceSlots(hits, candidates)
      : hits;
  }

  return Object.freeze({
    getGuidedTopic,
    isAboutRafaQuery,
    isFutureGoalQuery,
    isProjectDiscoveryQuery,
    plan,
    prioritizeProjectHitsByArchiveOrder,
    prioritizeProjectSourceSlots,
    selectFutureGoalHits,
    selectGenerationHits,
    selectGuidedTopicHits,
    selectSourceHits,
  });
}
