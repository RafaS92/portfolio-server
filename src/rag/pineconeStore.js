import { env } from "../config/env.js";
import { getPineconeClient } from "../lib/clients.js";
import { createPortfolioChunks } from "./chunkPortfolio.js";
import {
  PINECONE_RETURN_FIELDS,
  PINECONE_TEXT_FIELD,
  toPineconeRecord,
} from "./pineconeRecords.js";

export const PINECONE_EMBEDDING_MODEL = "llama-text-embed-v2";
export const PINECONE_CLOUD = "aws";
export const PINECONE_REGION = "us-east-1";
export const RERANK_CANDIDATE_TOP_K = 30;

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

export async function ensurePortfolioIndex(client = getPineconeClient()) {
  const indexName = env.PINECONE_INDEX;

  try {
    const existingIndex = await client.describeIndex(indexName);
    return { created: false, index: existingIndex };
  } catch (error) {
    if (error?.status !== 404 && error?.name !== "PineconeNotFoundError") {
      throw error;
    }
  }

  const index = await client.createIndexForModel({
    name: indexName,
    cloud: PINECONE_CLOUD,
    region: PINECONE_REGION,
    embed: {
      model: PINECONE_EMBEDDING_MODEL,
      fieldMap: { text: PINECONE_TEXT_FIELD },
    },
    schema: {
      fields: {
        locale: { filterable: true },
      },
    },
    waitUntilReady: true,
    timeout: 120_000,
    deletionProtection: "enabled",
    suppressConflicts: true,
  });

  return { created: true, index };
}

export function getPortfolioNamespace(client = getPineconeClient()) {
  return client
    .index(env.PINECONE_INDEX)
    .namespace(env.PINECONE_NAMESPACE);
}

export async function listRecordIds(namespace) {
  const ids = [];
  let paginationToken;

  do {
    const response = await namespace.listPaginated({
      limit: 100,
      ...(paginationToken ? { paginationToken } : {}),
    });

    ids.push(...(response.vectors ?? []).map((vector) => vector.id));
    paginationToken = response.pagination?.next;
  } while (paginationToken);

  return ids;
}

export async function syncPortfolioChunks({
  client = getPineconeClient(),
  chunks = createPortfolioChunks(),
} = {}) {
  const indexResult = await ensurePortfolioIndex(client);
  const namespace = getPortfolioNamespace(client);
  const currentIds = new Set(chunks.map((chunk) => chunk.id));
  const existingIds = await listRecordIds(namespace);
  const staleIds = existingIds.filter((id) => !currentIds.has(id));

  if (staleIds.length > 0) {
    await namespace.deleteMany({ ids: staleIds });
  }

  const records = chunks.map(toPineconeRecord);

  // Integrated embedding indexes accept at most 96 text records per request.
  for (let offset = 0; offset < records.length; offset += 96) {
    await namespace.upsertRecords({ records: records.slice(offset, offset + 96) });
  }

  return {
    indexCreated: indexResult.created,
    upserted: records.length,
    deleted: staleIds.length,
    indexName: env.PINECONE_INDEX,
    namespace: env.PINECONE_NAMESPACE,
  };
}

export async function searchPortfolio(
  query,
  { locale, topK = 3, client = getPineconeClient() } = {},
) {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("Search query must be a non-empty string.");
  }

  if (!new Set(["en", "es"]).has(locale)) {
    throw new Error('Search locale must be either "en" or "es".');
  }

  if (!Number.isInteger(topK) || topK < 1 || topK > 100) {
    throw new Error("topK must be an integer between 1 and 100.");
  }

  const namespace = getPortfolioNamespace(client);
  const candidateTopK =
    topK <= 3 ? Math.max(topK, RERANK_CANDIDATE_TOP_K) : topK;
  const response = await namespace.searchRecords({
    query: {
      topK: candidateTopK,
      inputs: { text: query.trim() },
      filter: { locale: { $eq: locale } },
    },
    fields: PINECONE_RETURN_FIELDS,
  });

  const hits = response.result.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    ...hit.fields,
  }));

  return candidateTopK > topK
    ? rerankPortfolioHits(query, hits, topK)
    : hits;
}
