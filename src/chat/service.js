/**
 * @typedef {Object} PublicSource
 * @property {string} id
 * @property {string} itemId
 * @property {number} score
 * @property {string} title
 * @property {string} contentType
 * @property {string} sectionId
 * @property {string} topic
 */

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

export function createChatService({
  retrievalPolicy,
  searchPortfolio,
  generateAnswer,
}) {
  return async function answerPortfolioQuestion(request, { signal } = {}) {
    const retrievalPlan = retrievalPolicy.plan(request);
    const retrievedHits = retrievalPlan.localHits ??
      await searchPortfolio(retrievalPlan.query, {
        locale: request.locale,
        topK: retrievalPlan.topK,
      });
    const hits = retrievalPolicy.selectGenerationHits(
      retrievalPlan,
      retrievedHits,
    );
    const sourceHits = retrievalPolicy.selectSourceHits(
      retrievalPlan,
      hits,
      retrievedHits,
    );
    const content = await generateAnswer(
      {
        ...request,
        hits,
        projectDiscovery: retrievalPlan.projectDiscovery,
        estimateInquiry: retrievalPlan.estimateInquiry,
        greeting: retrievalPlan.greeting,
        botIdentityInquiry: retrievalPlan.botIdentityInquiry,
      },
      { signal },
    );

    return {
      content,
      locale: request.locale,
      sources: sourceHits.map(toPublicSource),
    };
  };
}
