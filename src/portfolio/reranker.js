const SEARCH_STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "can", "did",
  "do", "does", "for", "from", "has", "have", "he", "how", "in", "is",
  "me", "of", "on", "or", "rafa", "tell", "that", "the", "to", "what",
  "when", "where", "which", "who", "why", "with", "you", "al", "como",
  "con", "cual", "cuales", "cuando", "de", "del", "donde", "el", "en",
  "es", "esta", "ha", "hace", "la", "las", "lo", "los", "para", "por",
  "que", "se", "sobre", "su", "sus", "un", "una", "y",
]);

const SEARCH_CONCEPTS = [
  ["ownership", "owned", "independently", "responsibility", "responsible", "independent", "responsabilidad", "responsable", "independiente", "supervision", "manejo"],
  ["independently", "independent", "autonomy", "autonomous", "little direction", "without supervision", "independiente", "autonomia", "poca supervision", "sin supervision"],
  ["end to end", "from development through", "end to end delivery", "desde el desarrollo hasta", "de principio a fin", "entrega completa"],
  ["feature", "functionality", "application", "funcionalidad", "funcionalidades", "aplicacion", "herramienta"],
  ["production support", "production issue", "production incident", "soporte en produccion", "problema de produccion", "incidente de produccion"],
  ["job search", "looking for", "seeking", "new position", "new role", "busca una posicion", "buscando", "nueva posicion"],
  ["reason", "motivation", "motivated", "because", "razon", "motivo", "motivacion", "porque"],
];

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSearchTokens(value) {
  return new Set(
    normalizeSearchText(value)
      .split(" ")
      .filter((token) => token.length > 2 && !SEARCH_STOP_WORDS.has(token)),
  );
}

function toMetadataText(hit) {
  return [
    hit.title,
    hit.organization,
    hit.role,
    hit.topic,
    ...(hit.technologies ?? []),
    ...(hit.tags ?? []),
  ].join(" ");
}

function coverage(queryTokens, candidateTokens) {
  if (queryTokens.size === 0) return 0;
  return [...queryTokens].filter((token) => candidateTokens.has(token)).length /
    queryTokens.size;
}

function conceptCoverage(normalizedQuery, normalizedCandidate) {
  const queryConcepts = SEARCH_CONCEPTS.filter((terms) =>
    terms.some((term) => normalizedQuery.includes(term)),
  );
  if (queryConcepts.length === 0) return 0;

  return queryConcepts.filter((terms) =>
    terms.some((term) => normalizedCandidate.includes(term)),
  ).length / queryConcepts.length;
}

export function rerankPortfolioHits(query, hits, topK) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = getSearchTokens(query);

  return hits
    .map((hit, originalIndex) => {
      const metadataText = toMetadataText(hit);
      const completeText = `${metadataText} ${hit.chunk_text ?? ""}`;
      const bodyTokens = getSearchTokens(hit.chunk_text);
      const metadataCoverage = coverage(queryTokens, getSearchTokens(metadataText));
      const bodyCoverage = coverage(queryTokens, bodyTokens);
      const concepts = conceptCoverage(
        normalizedQuery,
        normalizeSearchText(completeText),
      );
      const focus =
        metadataCoverage + bodyCoverage > 0
          ? 1 / Math.sqrt(Math.max(bodyTokens.size, 25) / 25)
          : 0;

      return {
        hit,
        originalIndex,
        rerankScore:
          hit.score +
          metadataCoverage * 0.18 +
          bodyCoverage * 0.12 +
          concepts * 0.65 +
          focus * 0.06,
      };
    })
    .sort(
      (left, right) =>
        right.rerankScore - left.rerankScore ||
        left.originalIndex - right.originalIndex,
    )
    .slice(0, topK)
    .map(({ hit }) => hit);
}
