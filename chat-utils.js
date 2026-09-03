export function buildRetrievalQuery(message) {
  return `Information about Rafa relevant to this request: ${message.trim()}`;
}
