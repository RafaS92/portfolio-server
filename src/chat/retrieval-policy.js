const PROJECT_DISCOVERY_TOP_K = 100;
const PROJECT_RECOMMENDATION_LIMIT = 4;
const PROJECT_DISCOVERY_PATTERN =
  /\b(projects?|portfolio work|work samples?|showcase|built|build|created|recommend(?:ed|ation|ations)?|suggest(?:ed|ion|ions)?|proyectos?|trabajos?|muestras?|construy[oó]|cre[oó]|recomienda|recomendar|sugiere|sugerencias)\b/iu;
const ABOUT_RAFA_PATTERN =
  /^(?:who is|who s|tell me about|describe|quien es|cuentame sobre|hablame de|describe a) (.+)$/u;
const RAFA_FULL_NAME = ["rafael", "salvador", "valdez", "vanegas"];
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
const YES_OR_NO_REPLY_PATTERN =
  /^(?:yes|yeah|yep|sure|okay|ok|please|yes please|no|nope|no thanks|not now|s[ií]|claro|por supuesto|est[aá] bien|por favor|s[ií] por favor|no gracias|ahora no)[.!]?$/iu;
const ESTIMATE_INQUIRY_PATTERNS = [
  /\b(?:estimate|quote|quotation|pricing|price|cost|budget)\b.*\b(?:project|website|site|app|application|service|work|build|develop|development)\b/u,
  /\b(?:project|website|site|app|application|service|work|build|develop|development)\b.*\b(?:estimate|quote|quotation|pricing|price|cost|budget)\b/u,
  /\b(?:get|give|need|request|provide|send)\b.*\b(?:estimate|quote|quotation)\b/u,
  /\b(?:cotizacion|presupuesto|precio|costo)\b.*\b(?:proyecto|sitio|pagina web|aplicacion|servicio|trabajo|desarrollo)\b/u,
  /\b(?:proyecto|sitio|pagina web|aplicacion|servicio|trabajo|desarrollo)\b.*\b(?:cotizacion|presupuesto|precio|costo)\b/u,
  /\b(?:dar|enviar|necesito|solicitar|obtener)\b.*\b(?:estimacion|cotizacion|presupuesto)\b/u,
  /\bcuanto (?:costaria|cuesta)\b/u,
];
const GREETING_PATTERN =
  /^(?:hey|hello|hi|hi there|hey there|good morning|good afternoon|good evening|hola|buenos dias|buenas tardes|buenas noches|que tal|saludos)[!.]?$/u;
const BOT_IDENTITY_PATTERN =
  /^(?:who are you|what are you|who am i (?:talking|speaking) (?:to|with)|who is this|is this rafa|are you rafa|am i (?:talking|speaking) (?:to|with) rafa|what is rafabot|who is rafabot|quien eres|que eres|con quien estoy hablando|quien habla|quien es este|eres rafa|estoy hablando con rafa|que es rafabot|quien es rafabot)$/u;
const GRATITUDE_PATTERN =
  /^(?:thanks|thank you|thanks a lot|thank you very much|thanks for (?:the )?help|i appreciate it|appreciate it|great|awesome|perfect|that helps|that was helpful|got it|gracias|muchas gracias|te lo agradezco|excelente|perfecto|eso ayuda|entendido)[!.]?$/u;
const GOODBYE_PATTERN =
  /^(?:bye|goodbye|see you|see you later|talk to you later|have a good day|have a nice day|take care|adios|hasta luego|nos vemos|hablamos luego|que tengas buen dia|cuidate)[!.]?$/u;
const RESUME_PATTERN =
  /\b(?:resume|cv|curriculum vitae|curriculum|hoja de vida)\b/u;
const LINKEDIN_PATTERN = /\blinkedin\b/u;
const GITHUB_PATTERN = /\bgithub\b/u;
const GENERAL_CONTACT_PATTERN =
  /\b(?:contact|email|e mail|reach|write to|message|correo|contactar|contacto|comunicarme|escribirle|mensaje)\b/u;

const LINKEDIN_URL = "https://www.linkedin.com/in/rafael-salvador-valdez";
const GITHUB_URL = "https://github.com/RafaS92";
const EMAIL_URL = "mailto:rvaldezdev.2020@gmail.com";

function normalizeReference(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(left, right) {
  const distances = Array.from(
    { length: left.length + 1 },
    (_, index) => index,
  );

  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let diagonal = distances[0];
    distances[0] = rightIndex;

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const previous = distances[leftIndex];
      distances[leftIndex] = Math.min(
        distances[leftIndex] + 1,
        distances[leftIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }

  return distances[left.length];
}

function isLikelyRafaName(value) {
  const nameParts = value.split(" ");

  if (nameParts.length === 1) {
    return editDistance(nameParts[0], "rafa") <= 1 ||
      editDistance(nameParts[0], "rafael") <= 2;
  }

  return nameParts.length === RAFA_FULL_NAME.length &&
    nameParts.every((part, index) =>
      editDistance(part, RAFA_FULL_NAME[index]) <= (index === 0 ? 2 : 1),
    );
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
  const previousAssistantMessage = [...history]
    .reverse()
    .find((entry) => entry.role === "assistant")?.content;

  if (YES_OR_NO_REPLY_PATTERN.test(message) && previousAssistantMessage) {
    const replyLabel = locale === "es"
      ? "El visitante respondió a esta oferta sobre Rafa"
      : "The visitor replied to this offer about Rafa";
    return `${previousAssistantMessage}\n${replyLabel}: ${message}`;
  }

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

export function isProjectEstimateQuery(message) {
  const normalizedMessage = normalizeReference(message);

  if (/\bhow does rafa estimate\b|\bcomo estima rafa\b/u.test(normalizedMessage)) {
    return false;
  }

  return ESTIMATE_INQUIRY_PATTERNS.some((pattern) =>
    pattern.test(normalizedMessage),
  );
}

export function isGreetingQuery(message) {
  return GREETING_PATTERN.test(normalizeReference(message));
}

export function isBotIdentityQuery(message) {
  return BOT_IDENTITY_PATTERN.test(normalizeReference(message));
}

export function getConversationClosing(message) {
  const normalizedMessage = normalizeReference(message);
  if (GRATITUDE_PATTERN.test(normalizedMessage)) return "gratitude";
  if (GOODBYE_PATTERN.test(normalizedMessage)) return "goodbye";
  return null;
}

export function isResumeQuery(message) {
  return RESUME_PATTERN.test(normalizeReference(message));
}

export function getContactQueryType(message) {
  const normalizedMessage = normalizeReference(message);
  if (LINKEDIN_PATTERN.test(normalizedMessage)) return "linkedin";
  if (GITHUB_PATTERN.test(normalizedMessage)) return "github";
  if (GENERAL_CONTACT_PATTERN.test(normalizedMessage)) return "contact";
  return null;
}

function buildActions({ locale, resumeInquiry, contactInquiry }) {
  if (resumeInquiry) {
    return [{
      type: "scroll_to_section",
      sectionId: "resume",
      label: locale === "es" ? "Ver currículum de Rafa" : "View Rafa's resume",
    }];
  }

  const labels = locale === "es"
    ? { contact: "Enviar correo a Rafa", linkedin: "LinkedIn de Rafa", github: "GitHub de Rafa" }
    : { contact: "Email Rafa", linkedin: "Rafa's LinkedIn", github: "Rafa's GitHub" };
  const urls = { contact: EMAIL_URL, linkedin: LINKEDIN_URL, github: GITHUB_URL };

  if (!contactInquiry) return [];
  if (contactInquiry !== "contact") {
    return [{ type: "external_link", url: urls[contactInquiry], label: labels[contactInquiry] }];
  }
  return Object.keys(urls).map((type) => ({
    type: "external_link",
    url: urls[type],
    label: labels[type],
  }));
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
    const match = normalizeReference(message).match(ABOUT_RAFA_PATTERN);
    return Boolean(match && isLikelyRafaName(match[1]));
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
    const conversationClosing = getConversationClosing(request.message);
    const resumeInquiry = isResumeQuery(request.message);
    const contactInquiry = resumeInquiry
      ? null
      : getContactQueryType(request.message);
    const greeting = isGreetingQuery(request.message);
    const botIdentityInquiry = isBotIdentityQuery(request.message);
    const estimateInquiry = isProjectEstimateQuery(request.message);
    const futureGoal = isFutureGoalQuery(request.message);
    const projectDiscovery =
      !futureGoal && isProjectDiscoveryQuery(request.message);
    const aboutRafa = isAboutRafaQuery(request.message);
    const guidedTopic = getGuidedTopic(request.message);
    const useLocalPortfolio = Boolean(guidedTopic || futureGoal);

    return {
      aboutRafa,
      actions: buildActions({ locale: request.locale, resumeInquiry, contactInquiry }),
      botIdentityInquiry,
      contactInquiry,
      conversationClosing,
      estimateInquiry,
      greeting,
      resumeInquiry,
      futureGoal,
      guidedTopic,
      projectDiscovery,
      query: aboutRafa
        ? (request.locale === "es" ? "¿Quién es Rafa?" : "Who is Rafa?")
        : buildRetrievalQuery(request),
      topK: projectDiscovery || aboutRafa ? PROJECT_DISCOVERY_TOP_K : 3,
      localHits: conversationClosing || resumeInquiry || contactInquiry ||
        greeting || botIdentityInquiry || estimateInquiry
        ? []
        : useLocalPortfolio
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
    getContactQueryType,
    getConversationClosing,
    isAboutRafaQuery,
    isBotIdentityQuery,
    isFutureGoalQuery,
    isGreetingQuery,
    isResumeQuery,
    isProjectEstimateQuery,
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
