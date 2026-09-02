import { SUPPORTED_LOCALES } from "./content.js";
import { PINECONE_RETURN_FIELDS } from "./pinecone-records.js";
import { rerankPortfolioHits } from "./reranker.js";

export const RERANK_CANDIDATE_TOP_K = 30;

/**
 * @typedef {Object} RetrievalHit
 * @property {string} id
 * @property {number} score
 * @property {string} chunk_text
 * @property {string} item_id
 * @property {string} section_id
 * @property {string} content_type
 */

export function createPineconeSearch({
  pineconeClient,
  indexName,
  namespace: namespaceName,
}) {
  const namespace = pineconeClient.index(indexName).namespace(namespaceName);

  /** @returns {Promise<RetrievalHit[]>} */
  return async function searchPortfolio(query, { locale, topK = 3 } = {}) {
    if (typeof query !== "string" || !query.trim()) {
      throw new Error("Search query must be a non-empty string.");
    }

    if (!SUPPORTED_LOCALES.includes(locale)) {
      throw new Error('Search locale must be either "en" or "es".');
    }

    if (!Number.isInteger(topK) || topK < 1 || topK > 100) {
      throw new Error("topK must be an integer between 1 and 100.");
    }

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
  };
}
