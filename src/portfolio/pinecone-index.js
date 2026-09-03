import { createPortfolioChunks } from "./chunks.js";
import {
  PINECONE_TEXT_FIELD,
  toPineconeRecord,
} from "./pinecone-records.js";

export const PINECONE_EMBEDDING_MODEL = "llama-text-embed-v2";
export const PINECONE_CLOUD = "aws";
export const PINECONE_REGION = "us-east-1";

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

export function createPineconeIndexManager({
  pineconeClient,
  indexName,
  namespace: namespaceName,
}) {
  async function ensurePortfolioIndex() {
    try {
      const existingIndex = await pineconeClient.describeIndex(indexName);
      return { created: false, index: existingIndex };
    } catch (error) {
      if (error?.status !== 404 && error?.name !== "PineconeNotFoundError") {
        throw error;
      }
    }

    const index = await pineconeClient.createIndexForModel({
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

  async function syncPortfolioChunks(chunks = createPortfolioChunks()) {
    const indexResult = await ensurePortfolioIndex();
    const namespace = pineconeClient.index(indexName).namespace(namespaceName);
    const currentIds = new Set(chunks.map((chunk) => chunk.id));
    const existingIds = await listRecordIds(namespace);
    const staleIds = existingIds.filter((id) => !currentIds.has(id));

    if (staleIds.length > 0) {
      await namespace.deleteMany({ ids: staleIds });
    }

    const records = chunks.map(toPineconeRecord);

    // Integrated embedding indexes accept at most 96 text records per request.
    for (let offset = 0; offset < records.length; offset += 96) {
      await namespace.upsertRecords({
        records: records.slice(offset, offset + 96),
      });
    }

    return {
      indexCreated: indexResult.created,
      upserted: records.length,
      deleted: staleIds.length,
      indexName,
      namespace: namespaceName,
    };
  }

  return Object.freeze({ ensurePortfolioIndex, syncPortfolioChunks });
}
