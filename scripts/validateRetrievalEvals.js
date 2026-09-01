import { loadRetrievalEvals } from "../src/rag/retrievalEvals.js";

const evaluations = loadRetrievalEvals();
const positiveCases = evaluations.cases.filter(
  (evaluation) => evaluation.expectedChunkIds.length > 0,
);
const negativeCases = evaluations.cases.length - positiveCases.length;

console.log(
  `Retrieval evaluations are valid: ${positiveCases.length} positive cases and ${negativeCases} out-of-scope cases.`,
);
