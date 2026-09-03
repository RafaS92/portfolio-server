export const PINECONE_TEXT_FIELD = "chunk_text";

export const PINECONE_RETURN_FIELDS = [
  PINECONE_TEXT_FIELD,
  "item_id",
  "section_id",
  "content_type",
  "locale",
  "title",
  "organization",
  "role",
  "topic",
  "start_date",
  "end_date",
  "technologies",
  "tags",
];

function withoutNullValues(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null),
  );
}

export function toPineconeRecord(chunk) {
  return withoutNullValues({
    _id: chunk.id,
    [PINECONE_TEXT_FIELD]: chunk.text,
    item_id: chunk.itemId,
    section_id: chunk.sectionId,
    content_type: chunk.contentType,
    locale: chunk.locale,
    title: chunk.title,
    organization: chunk.organization,
    role: chunk.role,
    topic: chunk.topic,
    start_date: chunk.startDate,
    end_date: chunk.endDate,
    technologies: chunk.technologies,
    tags: chunk.tags,
  });
}
