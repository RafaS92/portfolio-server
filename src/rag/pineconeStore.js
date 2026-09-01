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
  const response = await namespace.searchRecords({
    query: {
      topK,
      inputs: { text: query.trim() },
      filter: { locale: { $eq: locale } },
    },
    fields: PINECONE_RETURN_FIELDS,
  });

  return response.result.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    ...hit.fields,
  }));
}
